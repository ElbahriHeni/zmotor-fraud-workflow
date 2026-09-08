const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = require("express-rate-limit");
const net = require("net");
const PDFDocument = require("pdfkit");
const multer = require("multer");
const { createClient } = require("@supabase/supabase-js");
const { z } = require("zod");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const path = require("path");

require("dotenv").config({
  path: path.join(__dirname, ".env"),
  override: true,
  quiet: true,
});

const pool = require("./db");

const {
  bootstrapLocalAuthUsersDb,
} = require("./db-auth");

const {
  ensureRbacSchemaDb,
  getUserBaseByIdDb,
  getUserBaseByEmailDb,
  getUserBaseByEmailOrOidDb,
  buildSecurityContextDb,
  updateLastLoginDb,
  getPermissionsDb,
  getRolesDb,
  getRoleByIdDb,
  getUsersDb,
  getUserByIdDb,
  createUserDb,
  updateUserDb,
  setUserActiveDb,
  resetUserPasswordDb,
  setUserPermissionOverridesDb,
  createRoleDb,
  updateRoleDb,
  setRolePermissionsDb,
  countActiveSystemAdministratorsDb,
} = require("./db-rbac");

const {
  getDatabaseHealth,
  getDashboardSummaryDb,
  getCaseQueueDb,
} = require("./db-read");

const {
  getAssignedCasesDb,
} = require("./db-assistant");

const {
  runAssistant,
} = require("./assistant-service");

const {
  createFraudCaseDb,
} = require("./db-case-write");

const {
  findCaseByIdOrNumberDb,
} = require("./db-case-read");

const {
  getCaseDocumentsDb,
  getCaseActionLogsDb,
  getCaseAssignmentHistoryDb,
} = require("./db-case-support-read");

const {
  updateFraudCaseDb,
} = require("./db-case-update");

const {
  saveUploadedDocumentDb,
  saveManualDocumentDb,
  findDocumentByIdDb,
} = require("./db-documents");

const {
  getFraudCasesReportDb,
  getConfirmedFraudReportDb,
  getFraudIndicatorsReportDb,
  getSuspendedFraudReportDb,
  getFraudPerformanceReportDb,
} = require("./db-reports");

const {
  ensureAuditSchemaDb,
  writeAuditLogDb,
  getAuditLogsDb,
} = require("./db-audit");

const {
  ensureFraudAssessmentSchemaDb,
  getFraudAssessmentDb,
  saveFraudAssessmentDb,
  submitFraudAssessmentDb,
} = require("./db-fraud-assessment");

const {
  buildFraudAssessmentExcel,
  buildAllFraudAssessmentsExcel,
} = require("./fraud-assessment-excel");
const { FRAUD_ASSESSMENTS, getFraudAssessmentDefinition } = require("./fraud-assessment-config");
const { ensureMotorFraudSchemaDb } = require("./db-motor-fraud");
const { registerMotorFraudRoutes } = require("./motor-fraud-routes");

const app = express();

// Render and most production hosting platforms run behind a proxy/load balancer.
// This allows rate limiting to correctly identify the original client IP.

app.set("trust proxy", 1);

// IIS/ARR may forward IPv4 client addresses as "IP:PORT" (for example,
// "10.100.12.161:55480"). express-rate-limit expects a bare IP address.
// Normalize the proxy-provided value before using it as the rate-limit key.
function normalizeRateLimitIp(value) {
  let ip = String(value || "").trim();

  if (!ip) return "";
  if (net.isIP(ip)) return ip;

  // Bracketed IPv6 with an optional port: [2001:db8::1]:443
  const bracketedIpv6 = ip.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracketedIpv6 && net.isIP(bracketedIpv6[1])) {
    return bracketedIpv6[1];
  }

  // IPv4 with source port: 10.100.12.161:55480
  const ipv4WithPort = ip.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
  if (ipv4WithPort && net.isIP(ipv4WithPort[1]) === 4) {
    return ipv4WithPort[1];
  }

  return ip;
}

function rateLimitKeyGenerator(req) {
  const normalizedIp = normalizeRateLimitIp(
    req.ip || req.socket?.remoteAddress
  );

  // ipKeyGenerator preserves IPv4 keys and safely groups IPv6 clients
  // by subnet, which is the behavior expected by express-rate-limit v8.
  if (net.isIP(normalizedIp)) {
    return ipKeyGenerator(normalizedIp, 56);
  }

  // Defensive fallback. This should only be reached for a malformed proxy value.
  return String(req.socket?.remoteAddress || "unknown");
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024,
  },
});

let supabaseClient = null;

function getSupabaseClient() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase storage is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }

  if (!supabaseClient) {
    supabaseClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );
  }

  return supabaseClient;
}

function getStorageBucket() {
  return process.env.SUPABASE_BUCKET || "fraud-documents";
}

function sanitizeFileName(fileName) {
  return String(fileName || "document")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 160);
}

const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://fraud-web-complete.vercel.app",
  process.env.FRONTEND_URL,
  ...(process.env.FRONTEND_URLS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
].filter(Boolean);

app.use(
  helmet({
    // This is an API service. Disabling CSP avoids accidental blocking of file downloads/API clients,
    // while keeping the rest of Helmet's important HTTP security headers.
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: false,
  })
);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.API_RATE_LIMIT_MAX || 500),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKeyGenerator,
  message: {
    message: "Too many requests. Please try again later.",
  },
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.UPLOAD_RATE_LIMIT_MAX || 60),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKeyGenerator,
  message: {
    message: "Too many upload/download requests. Please try again later.",
  },
});

const assistantLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.ASSISTANT_RATE_LIMIT_MAX || 40),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKeyGenerator,
  message: {
    message: "Too many assistant requests. Please wait and try again.",
  },
});

app.use(
  cors({
    origin(origin, callback) {
      // Allow server-to-server calls, curl, Postman, health checks, and same-origin requests without an Origin header.
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked origin: ${origin}`));
    },
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use("/api/", apiLimiter);
app.use("/api/cases/:id/upload-document", uploadLimiter);
app.use("/api/assistant", assistantLimiter);
app.use("/api/documents/:documentId/download", uploadLimiter);

app.use(express.json({ limit: "1mb" }));

// -----------------------------------------------------------------------------
// API input validation + secure upload rules
// -----------------------------------------------------------------------------
const CASE_STATUS_VALUES = ["Draft", "Open", "Suspended", "Closed", "Received", "Reassigned", "مسودة", "مفتوح", "معلق", "مغلق", "مستلم", "إعادة التعيين"];
const CREATE_CASE_STATUS_VALUES = ["Draft", "Open", "Suspended", "Closed"];
const CASE_TYPE_VALUES = ["Fraud Confirmed", "Fraud Suspected", "Violation", "احتيال مؤكد", "اشتباه الاحتيال", "مخالفة"];
const CASE_SOURCE_VALUES = ["Website", "Internal", "Other", "الموقع", "داخلي", "أخرى"];
const PRIORITY_VALUES = ["High", "Medium", "Low", "عالية", "متوسطة", "منخفضة"];
const INSURANCE_TYPE_VALUES = ["Not Applicable", "Motor", "Medical", "Life", "General", "غير منطبق", "مركبات", "طبي", "حياة", "عام"];
const RISK_LEVEL_VALUES = ["High", "Medium", "Low", "عالية", "متوسطة", "منخفضة"];

const MAX_TEXT_LENGTH = 1000;
const MAX_LONG_TEXT_LENGTH = 5000;
const ALLOWED_UPLOAD_EXTENSIONS = new Set([".pdf", ".png", ".jpg", ".jpeg", ".docx", ".xlsx", ".txt"]);
const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
]);

function normalizeEmpty(value) {
  return value === "" || value === undefined ? null : value;
}

function optionalText(max = MAX_TEXT_LENGTH) {
  return z.preprocess(
    normalizeEmpty,
    z.string().trim().max(max, `Maximum length is ${max} characters.`).nullable().optional()
  );
}

function optionalDateString() {
  return z.preprocess(
    normalizeEmpty,
    z.string().trim().refine((value) => !value || !Number.isNaN(new Date(value).getTime()), {
      message: "Invalid date value.",
    }).nullable().optional()
  );
}

function optionalNumber(min = 0) {
  return z.preprocess(normalizeEmpty, z.coerce.number().finite().min(min).nullable().optional());
}

function optionalInteger(min = 0) {
  return z.preprocess(normalizeEmpty, z.coerce.number().int().min(min).nullable().optional());
}

function optionalBoolean() {
  return z.preprocess(
    (value) => {
      if (value === "" || value === undefined || value === null) return undefined;
      if (value === "true") return true;
      if (value === "false") return false;
      return value;
    },
    z.boolean().optional()
  );
}

function optionalEnum(values) {
  return z.preprocess(
    normalizeEmpty,
    z.string().trim().refine((value) => value === null || value === undefined || values.includes(value), {
      message: `Allowed values: ${values.join(", ")}`,
    }).nullable().optional()
  );
}

function validateBody(schema, body, res) {
  const result = schema.safeParse(body || {});

  if (result.success) {
    return result.data;
  }

  res.status(400).json({
    message: "Invalid request data.",
    errors: result.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    })),
  });

  return null;
}

const documentMetadataSchema = z.object({
  file_name: z.string().trim().min(1).max(255),
  file_type: optionalText(120),
  file_url: optionalText(2000),
  category: optionalText(100),
  uploaded_by: optionalText(150),
});

const fraudAssessmentAnswerSchema = z.object({
  question_code: z.string().trim().regex(/^\d{2}\.\d{3}$/, {
    message: "Invalid fraud assessment question code.",
  }),
  answer: z.union([
    z.string().max(MAX_LONG_TEXT_LENGTH),
    z.array(z.string().trim().max(250)).max(30),
  ]),
  comments: z.string().max(MAX_LONG_TEXT_LENGTH).optional().default(""),
  other_text: z.string().max(1000).optional().default(""),
});

function validateFraudAssessmentPayload(assessmentCode, body, res) {
  const definition = getFraudAssessmentDefinition(assessmentCode);
  if (!definition) {
    res.status(404).json({ message: "Fraud assessment not found." });
    return null;
  }

  const schema = z.object({
    answers: z.array(fraudAssessmentAnswerSchema)
      .max(definition.questionCodes.size)
      .superRefine((answers, context) => {
        const seen = new Set();
        answers.forEach((answer, index) => {
          if (!definition.questionCodes.has(answer.question_code)) {
            context.addIssue({
              code: "custom",
              path: [index, "question_code"],
              message: `Question ${answer.question_code} does not belong to assessment ${definition.code}.`,
            });
          }
          if (seen.has(answer.question_code)) {
            context.addIssue({
              code: "custom",
              path: [index, "question_code"],
              message: `Question ${answer.question_code} was provided more than once.`,
            });
          }
          seen.add(answer.question_code);
        });
      }),
  });

  return validateBody(schema, body, res);
}

const createCaseSchema = z.object({
  case_number: optionalText(80),
  case_status: optionalEnum(CREATE_CASE_STATUS_VALUES),

  reporter_name: optionalText(150),
  reporter_email: z.preprocess(normalizeEmpty, z.string().trim().email().max(255).nullable().optional()),
  reporter_mobile: optionalText(50),
  national_id_or_iqama: optionalText(50),
  consent_to_terms_and_privacy: optionalBoolean(),

  claim_id: optionalText(100),
  claim_type: optionalText(150),
  case_type: optionalEnum(CASE_TYPE_VALUES),
  case_source: optionalEnum(CASE_SOURCE_VALUES),
  case_source_other: optionalText(255),
  priority_level: optionalEnum(PRIORITY_VALUES),
  case_entry_date: optionalDateString(),
  insurance_type: optionalEnum(INSURANCE_TYPE_VALUES),
  suspected_amount: optionalNumber(0),
  description: optionalText(MAX_LONG_TEXT_LENGTH),

  has_claim: optionalBoolean(),
  suspension_date: optionalDateString(),
  suspension_reason: optionalText(MAX_LONG_TEXT_LENGTH),

  fraud_confirmed_date: optionalDateString(),
  fraud_detection_method: optionalText(255),
  fraud_amount: optionalNumber(0),
  action_taken: optionalText(MAX_LONG_TEXT_LENGTH),
  referred_entity: optionalText(255),
  fraud_indicator_type: optionalText(255),
  indicator_description: optionalText(MAX_LONG_TEXT_LENGTH),
  occurrence_count: optionalInteger(0),
  risk_score: optionalInteger(0),
  risk_level: optionalEnum(RISK_LEVEL_VALUES),
  system_recommendation: optionalText(MAX_LONG_TEXT_LENGTH),

  fraud_unit_notes: optionalText(MAX_LONG_TEXT_LENGTH),
  closure_reason: optionalText(MAX_LONG_TEXT_LENGTH),

  documents: z.array(documentMetadataSchema).optional(),
}).passthrough();

const reporterSchema = z.object({
  reporter_name: optionalText(150),
  reporter_email: z.preprocess(normalizeEmpty, z.string().trim().email().max(255).nullable().optional()),
  reporter_mobile: optionalText(50),
  national_id_or_iqama: optionalText(50),
  consent_to_terms_and_privacy: optionalBoolean(),
}).passthrough();

const overviewSchema = z.object({
  claim_id: optionalText(100),
  claim_type: optionalText(150),
  case_type: optionalEnum(CASE_TYPE_VALUES),
  case_source: optionalEnum(CASE_SOURCE_VALUES),
  case_source_other: optionalText(255),
  priority_level: optionalEnum(PRIORITY_VALUES),
  case_status: optionalEnum(["Open", "Suspended", "Closed", "مفتوح", "معلق", "مغلق"]),
  closure_reason: optionalText(MAX_LONG_TEXT_LENGTH),
  suspension_date: optionalDateString(),
  suspension_reason: optionalText(MAX_LONG_TEXT_LENGTH),
  case_entry_date: optionalDateString(),
  insurance_type: optionalEnum(INSURANCE_TYPE_VALUES),
  suspected_amount: optionalNumber(0),
  description: optionalText(MAX_LONG_TEXT_LENGTH),
  has_claim: optionalBoolean(),
  fraud_unit_notes: optionalText(MAX_LONG_TEXT_LENGTH),
}).passthrough();

const indicatorsSchema = z.object({
  fraud_confirmed_date: optionalDateString(),
  fraud_detection_method: optionalText(255),
  fraud_amount: optionalNumber(0),
  action_taken: optionalText(MAX_LONG_TEXT_LENGTH),
  referred_entity: optionalText(255),
  fraud_indicator_type: optionalText(255),
  indicator_description: optionalText(MAX_LONG_TEXT_LENGTH),
  occurrence_count: optionalInteger(0),
  risk_level: optionalEnum(RISK_LEVEL_VALUES),
}).passthrough();

const confirmedFraudSchema = z.object({
  claim_type: optionalText(150),
  fraud_confirmed_date: optionalDateString(),
  fraud_detection_method: optionalText(255),
  fraud_amount: optionalNumber(0),
  action_taken: optionalText(MAX_LONG_TEXT_LENGTH),
  referred_entity: optionalText(255),
}).passthrough();

const statusSchema = z.object({
  case_status: optionalEnum(CASE_STATUS_VALUES),
  closure_reason: optionalText(MAX_LONG_TEXT_LENGTH),
  closure_date: optionalDateString(),
  suspension_date: optionalDateString(),
  suspension_reason: optionalText(MAX_LONG_TEXT_LENGTH),
  responsible_user: optionalText(150),
}).passthrough();

const assignmentSchema = z.object({
  assigned_user: optionalText(150),
  assigned_by: optionalText(150),
  change_reason: optionalText(MAX_LONG_TEXT_LENGTH),
}).passthrough();

const releaseAssignmentSchema = z.object({
  released_by: optionalText(150),
  change_reason: optionalText(MAX_LONG_TEXT_LENGTH),
}).passthrough();

const manualDocumentSchema = documentMetadataSchema.strict();

const uploadDocumentBodySchema = z.object({
  category: optionalText(100),
  uploaded_by: optionalText(150),
}).passthrough();

const loginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(200),
}).passthrough();


const createUserSchema = z.object({
  full_name: z.string().trim().min(2).max(150),
  username: z.string().trim().min(2).max(100).regex(/^[a-zA-Z0-9._-]+$/, "Username may contain letters, numbers, dots, underscores, and hyphens."),
  email: z.string().trim().email().max(255),
  mobile_number: optionalText(50),
  role_id: z.coerce.number().int().positive(),
  auth_provider: z.enum(["local", "ad"]).default("local"),
  external_oid: optionalText(150),
  temporary_password: optionalText(200),
  is_active: z.boolean().optional().default(true),
  must_change_password: z.boolean().optional().default(true),
}).strict();

const updateUserSchema = z.object({
  full_name: z.string().trim().min(2).max(150).optional(),
  username: z.string().trim().min(2).max(100).regex(/^[a-zA-Z0-9._-]+$/, "Username may contain letters, numbers, dots, underscores, and hyphens.").optional(),
  email: z.string().trim().email().max(255).optional(),
  mobile_number: optionalText(50),
  role_id: z.coerce.number().int().positive().optional(),
  auth_provider: z.enum(["local", "ad"]).optional(),
  external_oid: optionalText(150),
  must_change_password: z.boolean().optional(),
}).strict();

const userStatusSchema = z.object({
  is_active: z.boolean(),
}).strict();

const resetPasswordSchema = z.object({
  temporary_password: z.string().min(10).max(200).optional(),
  generate_password: z.boolean().optional().default(false),
  must_change_password: z.boolean().optional().default(true),
}).strict();

const assistantChatSchema = z.object({
  message: z.string().trim().min(2).max(1500),
  language: z.enum(["en", "ar"]).optional(),
  conversation: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(3000),
  }).strict()).max(12).optional().default([]),
}).strict();

const changePasswordSchema = z.object({
  current_password: z.string().min(1).max(200),
  new_password: z.string().min(10).max(200),
}).strict();

const userPermissionOverridesSchema = z.object({
  overrides: z.array(z.object({
    permission_code: z.string().trim().min(1).max(120),
    is_allowed: z.boolean(),
  }).strict()).max(200),
}).strict();

const createRoleSchema = z.object({
  role_code: z.string().trim().min(2).max(80),
  role_name: z.string().trim().min(2).max(150),
  description: optionalText(1000),
}).strict();

const updateRoleSchema = z.object({
  role_name: z.string().trim().min(2).max(150).optional(),
  description: optionalText(1000),
  is_active: z.boolean().optional(),
}).strict();

const rolePermissionsSchema = z.object({
  permission_codes: z.array(z.string().trim().min(1).max(120)).max(200),
}).strict();

function generateTemporaryPassword(length = 16) {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%*_-+";
  const all = `${upper}${lower}${digits}${symbols}`;
  const required = [upper, lower, digits, symbols].map((set) => set[crypto.randomInt(0, set.length)]);
  while (required.length < Math.max(12, length)) required.push(all[crypto.randomInt(0, all.length)]);
  for (let index = required.length - 1; index > 0; index -= 1) {
    const randomIndex = crypto.randomInt(0, index + 1);
    [required[index], required[randomIndex]] = [required[randomIndex], required[index]];
  }
  return required.join("");
}

function getFileExtension(fileName) {
  const normalized = String(fileName || "").toLowerCase();
  const lastDotIndex = normalized.lastIndexOf(".");
  return lastDotIndex >= 0 ? normalized.slice(lastDotIndex) : "";
}

function validateUploadedFile(file, res) {
  if (!file) {
    return res.status(400).json({ message: "No file was uploaded. Use the field name 'document'." });
  }

  const extension = getFileExtension(file.originalname);
  const mimeType = String(file.mimetype || "").toLowerCase();

  if (!ALLOWED_UPLOAD_EXTENSIONS.has(extension)) {
    return res.status(400).json({
      message: `File extension is not allowed. Allowed file types: ${Array.from(ALLOWED_UPLOAD_EXTENSIONS).join(", ")}.`,
      message_ar: `نوع الملف غير مسموح. الأنواع المسموحة: ${Array.from(ALLOWED_UPLOAD_EXTENSIONS).join(", ")}.`,
      allowedExtensions: Array.from(ALLOWED_UPLOAD_EXTENSIONS),
    });
  }

  if (!ALLOWED_UPLOAD_MIME_TYPES.has(mimeType)) {
    return res.status(400).json({
      message: `File type is not allowed. Allowed file types: ${Array.from(ALLOWED_UPLOAD_EXTENSIONS).join(", ")}.`,
      message_ar: `نوع الملف غير مسموح. الأنواع المسموحة: ${Array.from(ALLOWED_UPLOAD_EXTENSIONS).join(", ")}.`,
      allowedTypes: Array.from(ALLOWED_UPLOAD_MIME_TYPES),
      allowedExtensions: Array.from(ALLOWED_UPLOAD_EXTENSIONS),
    });
  }

  return null;
}


// -----------------------------------------------------------------------------
// Authentication structure - development mode + future AD/Entra mode
// -----------------------------------------------------------------------------
// Local development:
//   AUTH_MODE=dev
//   DEV_USER_EMAIL=heni@demo.local
//   DEV_USER_NAME=Heni Elbahri
//
// Future production with Microsoft Entra ID / Active Directory:
//   AUTH_MODE=ad
//   AD_TENANT_ID=<customer tenant id>
//   AD_CLIENT_ID=<app registration client id>
//   AD_AUDIENCE=<usually same as AD_CLIENT_ID>
//
// In dev mode, the backend uses the DEV_USER values.
// In ad mode, the backend requires Authorization: Bearer <Microsoft token>.
let microsoftJwks = null;

function getAuthMode() {
  return (process.env.AUTH_MODE || "dev").trim().toLowerCase();
}

function buildDevUser() {
  const groups = String(process.env.DEV_USER_GROUPS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    id: "dev-user",
    email: process.env.DEV_USER_EMAIL || "dev-user@local",
    name: process.env.DEV_USER_NAME || "Development User",
    username: "dev-user",
    role: "SYSTEM_ADMIN",
    roleCode: "SYSTEM_ADMIN",
    roleName: "System Administrator",
    permissions: ["*"],
    effectivePermissions: [],
    canManageSecurity: true,
    groups,
    oid: "dev-user",
    authMode: "dev",
    tokenVersion: 0,
  };
}

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
}

async function getMicrosoftJwks() {
  const tenantId = process.env.AD_TENANT_ID;

  if (!tenantId) {
    throw new Error("AD_TENANT_ID is required when AUTH_MODE=ad.");
  }

  if (!microsoftJwks) {
    const { createRemoteJWKSet } = await import("jose");
    microsoftJwks = createRemoteJWKSet(
      new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`)
    );
  }

  return microsoftJwks;
}

async function validateMicrosoftToken(token) {
  const tenantId = process.env.AD_TENANT_ID;
  const audience = process.env.AD_AUDIENCE || process.env.AD_CLIENT_ID;

  if (!tenantId || !audience) {
    throw new Error("AD_TENANT_ID and AD_AUDIENCE/AD_CLIENT_ID are required when AUTH_MODE=ad.");
  }

  const { jwtVerify } = await import("jose");
  const jwks = await getMicrosoftJwks();

  const issuer = `https://login.microsoftonline.com/${tenantId}/v2.0`;

  const { payload } = await jwtVerify(token, jwks, {
    issuer,
    audience,
  });

  const email =
    payload.preferred_username ||
    payload.email ||
    payload.upn ||
    payload.unique_name ||
    payload.oid;

  return {
    email: String(email || "").toLowerCase(),
    name: payload.name || email || "Authenticated User",
    oid: payload.oid || payload.sub,
    groups: Array.isArray(payload.groups) ? payload.groups : [],
    tenantId: payload.tid,
    authMode: "ad",
  };
}


function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 24) {
    throw new Error("JWT_SECRET must be configured and at least 24 characters long when AUTH_MODE=local.");
  }

  return secret;
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function createLocalAuthToken(user) {
  return jwt.sign(
    {
      sub: String(user.id),
      email: user.email,
      name: user.name,
      role: user.roleCode || user.role,
      tokenVersion: Number(user.tokenVersion || 0),
      authMode: "local",
    },
    getJwtSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
  );
}

async function findActiveAppUserByEmail(email) {
  const user = await getUserBaseByEmailDb(pool, email, true);
  if (!user || !(user.is_active === true || user.is_active === 1)) return null;
  return user;
}

async function findActiveAppUserById(id) {
  const user = await getUserBaseByIdDb(pool, id, false);
  if (!user || !(user.is_active === true || user.is_active === 1)) return null;
  return user;
}

async function validateLocalToken(token) {
  let payload;

  try {
    payload = jwt.verify(token, getJwtSecret());
  } catch {
    const error = new Error("Invalid or expired login session.");
    error.statusCode = 401;
    throw error;
  }

  const user = await findActiveAppUserById(payload.sub);

  if (!user) {
    const error = new Error("User account is inactive or no longer exists.");
    error.statusCode = 401;
    throw error;
  }

  if (Number(payload.tokenVersion || 0) !== Number(user.token_version || 0)) {
    const error = new Error("Your session is no longer valid. Please sign in again.");
    error.statusCode = 401;
    throw error;
  }

  const securityContext = await buildSecurityContextDb(pool, user, "local");
  if (!securityContext) {
    const error = new Error("User role is inactive or unavailable.");
    error.statusCode = 403;
    throw error;
  }

  return securityContext;
}

async function bootstrapLocalAuthUsers() {
  return bootstrapLocalAuthUsersDb(pool);
}

function getAllowedAdGroupIds() {
  return String(process.env.AD_ALLOWED_GROUP_ID || process.env.AD_ALLOWED_GROUP_IDS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isUserInAllowedGroup(user) {
  const allowedGroups = getAllowedAdGroupIds();

  // Empty means group authorization is not enabled yet.
  // This keeps local development and early customer testing simple.
  if (allowedGroups.length === 0) {
    return true;
  }

  const userGroups = Array.isArray(user.groups) ? user.groups : [];
  return allowedGroups.some((groupId) => userGroups.includes(groupId));
}

function ensureGroupAuthorization(user) {
  if (!isUserInAllowedGroup(user)) {
    const error = new Error("Access denied. User is not a member of the required AD group.");
    error.statusCode = 403;
    throw error;
  }
}

async function attachCurrentUser(req, res, next) {
  try {
    const publicPaths = new Set(["/", "/api/health", "/api/auth/login"]);

    if (publicPaths.has(req.path)) {
      return next();
    }

    const authMode = getAuthMode();

    if (authMode === "dev") {
      const devUser = buildDevUser();
      ensureGroupAuthorization(devUser);
      req.currentUser = devUser;
      return next();
    }

    if (authMode === "local") {
      const token = getBearerToken(req);

      if (!token) {
        return res.status(401).json({
          message: "Authentication required. Please sign in.",
        });
      }

      const localUser = await validateLocalToken(token);
      req.currentUser = localUser;
      return next();
    }

    if (authMode === "ad") {
      const token = getBearerToken(req);

      if (!token) {
        return res.status(401).json({
          message: "Authentication required. Missing Authorization bearer token.",
        });
      }

      const tokenUser = await validateMicrosoftToken(token);
      ensureGroupAuthorization(tokenUser);

      const applicationUser = await getUserBaseByEmailOrOidDb(pool, tokenUser.email, tokenUser.oid);
      if (!applicationUser || !(applicationUser.is_active === true || applicationUser.is_active === 1)) {
        return res.status(403).json({
          message: "Access denied. Your Microsoft account has not been approved for this application.",
        });
      }

      if (String(applicationUser.auth_provider || "").toLowerCase() !== "ad") {
        return res.status(403).json({
          message: "Access denied. This application account is configured for local sign-in, not Microsoft sign-in.",
        });
      }

      const securityContext = await buildSecurityContextDb(pool, applicationUser, "ad", tokenUser);
      if (!securityContext) {
        return res.status(403).json({ message: "Access denied. Your assigned application role is inactive." });
      }

      req.currentUser = securityContext;
      return next();
    }

    return res.status(500).json({
      message: `Unsupported AUTH_MODE '${authMode}'. Use 'dev', 'local', or 'ad'.`,
    });
  } catch (error) {
    const statusCode = error.statusCode || 401;

    return res.status(statusCode).json({
      message: statusCode === 403 ? "Access denied." : "Authentication failed.",
      error: error.message,
    });
  }
}

function getCurrentUser(req) {
  return req.currentUser || buildDevUser();
}

function getCurrentUserEmail(req) {
  return getCurrentUser(req).email || "System";
}

function getCurrentUserName(req) {
  return getCurrentUser(req).name || getCurrentUserEmail(req);
}

function normalizeUserKey(value) {
  return String(value || "").trim().toLowerCase();
}

function isDraftCase(fraudCase) {
  return fraudCase && fraudCase.case_status === "Draft";
}

function isCaseCreator(req, fraudCase) {
  return normalizeUserKey(fraudCase?.created_by) === normalizeUserKey(getCurrentUserEmail(req));
}

function canAccessCase(req, fraudCase) {
  if (!fraudCase) return false;

  // Business rule:
  // Draft cases are private to the creator.
  // Open/Closed/submitted cases are visible to all authenticated fraud users.
  if (isDraftCase(fraudCase)) {
    return isCaseCreator(req, fraudCase);
  }

  return true;
}

function denyDraftAccess(res) {
  return res.status(403).json({
    message: "You are not allowed to access another user's draft case.",
  });
}

async function requireCaseAccess(req, res, id, client = pool) {
  const fraudCase = await findCaseByIdOrNumber(id, client);

  if (!fraudCase) {
    res.status(404).json({ message: "Case not found" });
    return null;
  }

  if (!canAccessCase(req, fraudCase)) {
    denyDraftAccess(res);
    return null;
  }

  return fraudCase;
}

app.use(attachCurrentUser);

function isSystemAdministrator(user) {
  const role = String(user?.roleCode || user?.role || "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  return role === "SYSTEM_ADMIN" || role === "ADMIN" || role === "SYSTEM_ADMINISTRATOR";
}

function hasPermission(user, permissionCode) {
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  return isSystemAdministrator(user) || permissions.includes("*") || permissions.includes(permissionCode);
}

function requirePermission(permissionCode) {
  return (req, res, next) => {
    if (!hasPermission(getCurrentUser(req), permissionCode)) {
      return res.status(403).json({
        message: `You do not have permission to perform this action (${permissionCode}).`,
      });
    }
    return next();
  };
}


function requireAnyPermission(...permissionCodes) {
  return (req, res, next) => {
    const user = getCurrentUser(req);
    if (!permissionCodes.some((code) => hasPermission(user, code))) {
      return res.status(403).json({
        message: `You do not have permission to perform this action (${permissionCodes.join(" or ")}).`,
      });
    }
    return next();
  };
}

function requireSystemAdministrator(req, res, next) {
  if (!isSystemAdministrator(getCurrentUser(req))) {
    return res.status(403).json({
      message: "System administrator access is required.",
    });
  }

  return next();
}

function sanitizeAuditValue(value, depth = 0) {
  if (depth > 4) return "[truncated]";
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeAuditValue(item, depth + 1));
  if (!value || typeof value !== "object") return value;

  const sanitized = {};
  const sensitivePattern = /(password|token|secret|authorization|cookie|password_hash|internal_comment)/i;

  for (const [key, item] of Object.entries(value)) {
    sanitized[key] = sensitivePattern.test(key) ? "[REDACTED]" : sanitizeAuditValue(item, depth + 1);
  }

  return sanitized;
}

function getAuditDescriptor(req) {
  const path = req.path || "";
  const method = req.method || "GET";
  let actionCode = `${method}_API_REQUEST`;
  let entityType = "API";
  const pathParts = path.split("/").filter(Boolean);
  let entityId = req.params?.id || req.params?.documentId || null;

  if (!entityId && pathParts[0] === "api" && pathParts[1] === "cases" && pathParts[2]) {
    entityId = pathParts[2];
  }

  if (!entityId && pathParts[0] === "api" && pathParts[1] === "documents" && pathParts[2]) {
    entityId = pathParts[2];
  }

  if (path === "/api/auth/login") {
    actionCode = "USER_LOGIN";
    entityType = "AUTHENTICATION";
    entityId = req.body?.email || null;
  } else if (path === "/api/auth/change-password") {
    actionCode = "USER_PASSWORD_CHANGED";
    entityType = "USER";
    entityId = req.currentUser?.id || null;
  } else if (method === "POST" && path === "/api/admin/users") {
    actionCode = "USER_CREATED";
    entityType = "USER";
    entityId = req.body?.email || null;
  } else if (/^\/api\/admin\/users\/[^/]+\/status$/.test(path)) {
    actionCode = "USER_STATUS_CHANGED";
    entityType = "USER";
  } else if (/^\/api\/admin\/users\/[^/]+\/reset-password$/.test(path)) {
    actionCode = "USER_PASSWORD_RESET";
    entityType = "USER";
  } else if (/^\/api\/admin\/users\/[^/]+\/permissions$/.test(path)) {
    actionCode = "USER_PERMISSIONS_UPDATED";
    entityType = "USER";
  } else if (/^\/api\/admin\/users\/[^/]+$/.test(path) && method === "PATCH") {
    actionCode = "USER_UPDATED";
    entityType = "USER";
  } else if (method === "POST" && path === "/api/admin/roles") {
    actionCode = "ROLE_CREATED";
    entityType = "ROLE";
    entityId = req.body?.role_code || null;
  } else if (/^\/api\/admin\/roles\/[^/]+\/permissions$/.test(path)) {
    actionCode = "ROLE_PERMISSIONS_UPDATED";
    entityType = "ROLE";
  } else if (/^\/api\/admin\/roles\/[^/]+$/.test(path) && method === "PATCH") {
    actionCode = "ROLE_UPDATED";
    entityType = "ROLE";
  } else if (method === "POST" && path === "/api/cases") {
    actionCode = "CASE_CREATED";
    entityType = "CASE";
  } else if (/^\/api\/cases\/[^/]+\/status$/.test(path)) {
    actionCode = "CASE_STATUS_CHANGED";
    entityType = "CASE";
  } else if (/^\/api\/cases\/[^/]+\/assign$/.test(path)) {
    actionCode = "CASE_ASSIGNED";
    entityType = "CASE";
  } else if (/^\/api\/cases\/[^/]+\/release-assignment$/.test(path)) {
    actionCode = "CASE_ASSIGNMENT_RELEASED";
    entityType = "CASE";
  } else if (/^\/api\/cases\/[^/]+\/(reporter|overview|indicators|confirmed-fraud)$/.test(path)) {
    actionCode = "CASE_SECTION_UPDATED";
    entityType = "CASE";
  } else if (/^\/api\/cases\/[^/]+$/.test(path) && method === "PATCH") {
    actionCode = "CASE_UPDATED";
    entityType = "CASE";
  } else if (/upload-document$/.test(path)) {
    actionCode = "DOCUMENT_UPLOADED";
    entityType = "DOCUMENT";
  } else if (/^\/api\/documents\/[^/]+\/download$/.test(path)) {
    actionCode = "DOCUMENT_DOWNLOADED";
    entityType = "DOCUMENT";
  } else if (/export-pdf$/.test(path)) {
    actionCode = "CASE_PDF_EXPORTED";
    entityType = "CASE";
  } else if (path === "/api/assistant/chat") {
    actionCode = req.auditAssistantAction || "ASSISTANT_QUESTION";
    entityType = "ASSISTANT";
    entityId = req.auditEntityId || null;
  } else if (/^\/api\/fraud-assessments\/[^/]+\/export$/.test(path)) {
    actionCode = "FRAUD_ASSESSMENT_EXPORTED";
    entityType = "FRAUD_ASSESSMENT";
    entityId = req.params?.assessmentCode || path.split("/")[3] || null;
  } else if (/^\/api\/fraud-assessments\/[^/]+\/submit$/.test(path)) {
    actionCode = "FRAUD_ASSESSMENT_SUBMITTED";
    entityType = "FRAUD_ASSESSMENT";
    entityId = req.params?.assessmentCode || path.split("/")[3] || null;
  } else if (/^\/api\/fraud-assessments\/[^/]+$/.test(path) && ["PUT", "PATCH"].includes(method)) {
    actionCode = "FRAUD_ASSESSMENT_UPDATED";
    entityType = "FRAUD_ASSESSMENT";
    entityId = req.params?.assessmentCode || path.split("/")[3] || null;
  } else if (/^\/api\/motor-fraud\//.test(path)) {
    actionCode = `MOTOR_FRAUD_${method}_REQUEST`;
    entityType = "MOTOR_FRAUD";
    entityId = req.params?.id || req.params?.documentId || null;
  } else if (/^\/api\/reports\//.test(path)) {
    actionCode = "REPORT_ACCESSED";
    entityType = "REPORT";
    entityId = path.split("/").pop();
  }

  return { actionCode, entityType, entityId };
}

function shouldAuditRequest(req) {
  if (["POST", "PATCH", "PUT", "DELETE"].includes(req.method)) return true;
  return /\/(download|export-pdf|export)$/.test(req.path) || /^\/api\/reports\//.test(req.path) || /^\/api\/motor-fraud\//.test(req.path);
}

app.use((req, res, next) => {
  if (!shouldAuditRequest(req)) return next();

  const startedAt = Date.now();
  res.on("finish", () => {
    const descriptor = getAuditDescriptor(req);
    const actor = req.auditUser || req.currentUser || {};

    writeAuditLogDb(pool, {
      actorUserId: actor.id || actor.oid || null,
      actorEmail: actor.email || req.body?.email || null,
      actorName: actor.name || null,
      actorRole: actor.role || null,
      actionCode: res.statusCode >= 400 && descriptor.actionCode === "USER_LOGIN" ? "USER_LOGIN_FAILED" : descriptor.actionCode,
      entityType: descriptor.entityType,
      entityId: req.auditEntityId || descriptor.entityId,
      httpMethod: req.method,
      route: req.originalUrl || req.path,
      success: res.statusCode < 400,
      statusCode: res.statusCode,
      details: req.auditDetails || {
        body: sanitizeAuditValue(req.body || {}),
        query: sanitizeAuditValue(req.query || {}),
        duration_ms: Date.now() - startedAt,
      },
      ipAddress: req.ip || req.socket?.remoteAddress || null,
      userAgent: req.get("user-agent") || null,
    }).catch((error) => {
      console.error("Failed to write audit log", error.message);
    });
  });

  return next();
});

registerMotorFraudRoutes(app, {
  pool,
  requirePermission,
  hasPermission,
  isSystemAdministrator,
  getCurrentUser,
  getCurrentUserEmail,
  getCurrentUserName,
  upload,
  validateUploadedFile,
});

function safePdfValue(value) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function formatPdfDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function addPdfSection(doc, title) {
  doc.moveDown(1);
  doc.font("Helvetica-Bold").fontSize(14).text(title, { underline: true });
  doc.moveDown(0.4);
}

function addPdfField(doc, label, value) {
  doc.font("Helvetica-Bold").fontSize(10).text(`${label}: `, { continued: true });
  doc.font("Helvetica").fontSize(10).text(safePdfValue(value));
}

function addPdfLongField(doc, label, value) {
  doc.font("Helvetica-Bold").fontSize(10).text(`${label}:`);
  doc.font("Helvetica").fontSize(10).text(safePdfValue(value), { align: "left" });
}


const CASE_FIELDS = [
  "case_number",
  "claim_id",
  "case_type",
  "case_source",
  "case_source_other",
  "priority_level",
  "case_status",
  "assigned_user",
  "assignment_date",
  "assigned_by",
  "reassignment_reason",
  "case_entry_date",
  "closure_date",
  "closure_reason",
  "insurance_type",
  "suspected_amount",
  "fraud_unit_notes",
  "reporter_name",
  "reporter_email",
  "reporter_mobile",
  "national_id_or_iqama",
  "description",
  "consent_to_terms_and_privacy",
  "has_claim",
  "claim_type",
  "claim_status",
  "suspension_date",
  "suspension_reason",
  "fraud_confirmed_date",
  "fraud_detection_method",
  "fraud_amount",
  "action_taken",
  "referred_entity",
  "fraud_indicator_type",
  "indicator_description",
  "occurrence_count",
  "risk_score",
  "risk_level",
  "system_recommendation",
  "created_by",
];

function emptyToNull(value) {
  if (value === undefined || value === "") return null;
  return value;
}

function toNumber(value, defaultValue = 0) {
  if (value === undefined || value === null || value === "") return defaultValue;
  const numeric = Number(value);
  return Number.isNaN(numeric) ? defaultValue : numeric;
}

async function findCaseByIdOrNumber(id, client = pool) {
  return findCaseByIdOrNumberDb(pool, id, client);
}

async function insertActionLog(client, fraudCaseId, responsible, status) {
  await client.query(
    `
    INSERT INTO case_action_logs (
      fraud_case_id,
      responsible_user,
      status
    )
    VALUES ($1::integer, $2::text, $3::text)
    `,
    [fraudCaseId, responsible || "System", status || "Updated"]
  );
}

function buildInsertQuery(tableName, data) {
  const keys = Object.keys(data).filter((key) => CASE_FIELDS.includes(key));
  const placeholders = keys.map((_, index) => `$${index + 1}`);
  const values = keys.map((key) => data[key]);

  return {
    text: `
      INSERT INTO ${tableName} (${keys.join(", ")})
      VALUES (${placeholders.join(", ")})
      RETURNING *
    `,
    values,
  };
}

async function updateFraudCase(client, id, fields) {
  const entries = Object.entries(fields).filter(([key]) => CASE_FIELDS.includes(key));

  if (entries.length === 0) {
    return findCaseByIdOrNumber(id, client);
  }

  const setSql = entries.map(([key], index) => `${key} = $${index + 1}`).join(",\n          ");
  const values = entries.map(([, value]) => value);
  values.push(id);

  const result = await client.query(
    `
    UPDATE fraud_cases
    SET ${setSql},
        updated_at = CURRENT_TIMESTAMP
    WHERE id::text = $${values.length}::text OR case_number = $${values.length}::text
    RETURNING *
    `,
    values
  );

  return result.rows[0] || null;
}

app.get("/", (req, res) => {
  res.send("Fraud Management Backend API is running");
});

app.get("/api/health", async (req, res) => {
  try {
    const health = await getDatabaseHealth(pool);

    res.json({
      status: "ok",
      backend: "running",
      database: health.database,
      databaseType: health.type,
      time: health.time,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      backend: "running",
      database: "not connected",
      message: error.message,
    });
  }
});


app.post("/api/auth/login", async (req, res) => {
  try {
    if (getAuthMode() !== "local") {
      return res.status(400).json({
        message: "Local email/password login is not enabled on this environment.",
      });
    }

    const body = validateBody(loginSchema, req.body, res);
    if (!body) return;

    const user = await findActiveAppUserByEmail(body.email);

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    if (String(user.auth_provider || "local").toLowerCase() !== "local") {
      return res.status(403).json({ message: "This account must sign in using Microsoft." });
    }

    const isPasswordValid = await bcrypt.compare(body.password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const currentUser = await buildSecurityContextDb(pool, user, "local");
    if (!currentUser) {
      return res.status(403).json({ message: "Your assigned role is inactive or unavailable." });
    }

    await updateLastLoginDb(pool, user.id);
    const token = createLocalAuthToken(currentUser);
    req.auditUser = currentUser;

    res.json({
      token,
      user: currentUser,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to login.",
      error: error.message,
    });
  }
});

app.get("/api/auth/me", (req, res) => {
  res.json(getCurrentUser(req));
});

app.post("/api/auth/change-password", async (req, res) => {
  try {
    const body = validateBody(changePasswordSchema, req.body, res);
    if (!body) return;

    const currentUser = getCurrentUser(req);
    const user = await getUserBaseByIdDb(pool, currentUser.id, true);

    if (!user || !(user.is_active === true || user.is_active === 1)) {
      return res.status(404).json({ message: "User account not found." });
    }

    if (String(user.auth_provider || "local").toLowerCase() !== "local") {
      return res.status(400).json({ message: "Microsoft/AD passwords are managed outside this application." });
    }

    const currentPasswordValid = await bcrypt.compare(body.current_password, user.password_hash || "");
    if (!currentPasswordValid) {
      return res.status(400).json({ message: "The current password is incorrect." });
    }

    const isSamePassword = await bcrypt.compare(body.new_password, user.password_hash || "");
    if (isSamePassword) {
      return res.status(400).json({ message: "The new password must be different from the current password." });
    }

    const passwordHash = await bcrypt.hash(body.new_password, 10);
    await resetUserPasswordDb(pool, user.id, passwordHash, false, currentUser.email);
    req.auditEntityId = String(user.id);

    return res.json({ message: "Password changed successfully. Please sign in again." });
  } catch (error) {
    return sendAdminError(res, error, "Failed to change password.");
  }
});

function sendAdminError(res, error, fallbackMessage) {
  const statusCode = Number(error.statusCode || 500);
  return res.status(statusCode).json({
    message: statusCode >= 500 ? fallbackMessage : error.message,
    error: statusCode >= 500 ? error.message : undefined,
  });
}

app.get("/api/admin/permissions", requireAnyPermission("roles.view", "users.view"), async (req, res) => {
  try {
    res.json(await getPermissionsDb(pool));
  } catch (error) {
    sendAdminError(res, error, "Failed to fetch permissions.");
  }
});

app.get("/api/admin/roles", requireAnyPermission("roles.view", "users.view"), async (req, res) => {
  try {
    const includeInactive = String(req.query.includeInactive || "true").toLowerCase() !== "false";
    res.json(await getRolesDb(pool, includeInactive));
  } catch (error) {
    sendAdminError(res, error, "Failed to fetch roles.");
  }
});

app.get("/api/admin/roles/:id", requireAnyPermission("roles.view", "users.view"), async (req, res) => {
  try {
    const role = await getRoleByIdDb(pool, req.params.id);
    if (!role) return res.status(404).json({ message: "Role not found." });
    res.json(role);
  } catch (error) {
    sendAdminError(res, error, "Failed to fetch role details.");
  }
});

app.post("/api/admin/roles", requirePermission("roles.create"), async (req, res) => {
  try {
    const body = validateBody(createRoleSchema, req.body, res);
    if (!body) return;
    const role = await createRoleDb(pool, body);
    req.auditEntityId = role.id;
    res.status(201).json(role);
  } catch (error) {
    sendAdminError(res, error, "Failed to create role.");
  }
});

app.patch("/api/admin/roles/:id", requirePermission("roles.update"), async (req, res) => {
  try {
    const body = validateBody(updateRoleSchema, req.body, res);
    if (!body) return;
    const existing = await getRoleByIdDb(pool, req.params.id);
    if (!existing) return res.status(404).json({ message: "Role not found." });
    if (existing.role_code === "SYSTEM_ADMIN" && body.is_active === false) {
      return res.status(400).json({ message: "The System Administrator role cannot be deactivated." });
    }
    const role = await updateRoleDb(pool, req.params.id, body);
    req.auditEntityId = role.id;
    res.json(role);
  } catch (error) {
    sendAdminError(res, error, "Failed to update role.");
  }
});

app.put("/api/admin/roles/:id/permissions", requirePermission("roles.manage_permissions"), async (req, res) => {
  try {
    const body = validateBody(rolePermissionsSchema, req.body, res);
    if (!body) return;
    if (!isSystemAdministrator(getCurrentUser(req))) {
      const invalidGrant = body.permission_codes.find((code) => !hasPermission(getCurrentUser(req), code));
      if (invalidGrant) {
        return res.status(403).json({ message: `You cannot assign a permission you do not possess (${invalidGrant}).` });
      }
    }
    const role = await setRolePermissionsDb(pool, req.params.id, body.permission_codes);
    if (!role) return res.status(404).json({ message: "Role not found." });
    req.auditEntityId = role.id;
    res.json(role);
  } catch (error) {
    sendAdminError(res, error, "Failed to update role permissions.");
  }
});

app.get("/api/admin/users", requirePermission("users.view"), async (req, res) => {
  try {
    res.json(await getUsersDb(pool, {
      search: req.query.search,
      roleId: req.query.roleId,
      status: req.query.status,
    }));
  } catch (error) {
    sendAdminError(res, error, "Failed to fetch users.");
  }
});

app.get("/api/admin/users/:id", requirePermission("users.view"), async (req, res) => {
  try {
    const user = await getUserByIdDb(pool, req.params.id);
    if (!user) return res.status(404).json({ message: "User not found." });
    res.json(user);
  } catch (error) {
    sendAdminError(res, error, "Failed to fetch user details.");
  }
});

app.post("/api/admin/users", requirePermission("users.create"), async (req, res) => {
  try {
    const body = validateBody(createUserSchema, req.body, res);
    if (!body) return;
    const selectedRole = await getRoleByIdDb(pool, body.role_id);
    if (!selectedRole) return res.status(400).json({ message: "Selected role does not exist." });
    if (!(selectedRole.is_active === true || selectedRole.is_active === 1)) return res.status(400).json({ message: "Selected role is inactive." });
    if (selectedRole.role_code === "SYSTEM_ADMIN" && !isSystemAdministrator(getCurrentUser(req))) {
      return res.status(403).json({ message: "Only a System Administrator can create another System Administrator." });
    }
    if (body.auth_provider === "local" && (!body.temporary_password || body.temporary_password.length < 10)) {
      return res.status(400).json({ message: "A local user requires a temporary password of at least 10 characters." });
    }
    if (body.auth_provider === "ad" && !body.external_oid && !body.email) {
      return res.status(400).json({ message: "An AD user requires a corporate email or Microsoft Object ID." });
    }
    const passwordHash = body.temporary_password ? await bcrypt.hash(body.temporary_password, 10) : null;
    const user = await createUserDb(pool, {
      ...body,
      password_hash: passwordHash,
    }, getCurrentUserEmail(req));
    req.auditEntityId = user.id;
    res.status(201).json(user);
  } catch (error) {
    sendAdminError(res, error, "Failed to create user.");
  }
});

app.patch("/api/admin/users/:id", requirePermission("users.update"), async (req, res) => {
  try {
    const body = validateBody(updateUserSchema, req.body, res);
    if (!body) return;
    const target = await getUserByIdDb(pool, req.params.id);
    if (!target) return res.status(404).json({ message: "User not found." });
    if (target.role_code === "SYSTEM_ADMIN" && !isSystemAdministrator(getCurrentUser(req))) {
      return res.status(403).json({ message: "Only a System Administrator can update another System Administrator." });
    }

    if (body.role_id) {
      const selectedRole = await getRoleByIdDb(pool, body.role_id);
      if (!selectedRole) return res.status(400).json({ message: "Selected role does not exist." });
      if (!(selectedRole.is_active === true || selectedRole.is_active === 1)) return res.status(400).json({ message: "Selected role is inactive." });
      if (selectedRole.role_code === "SYSTEM_ADMIN" && !isSystemAdministrator(getCurrentUser(req))) {
        return res.status(403).json({ message: "Only a System Administrator can assign the System Administrator role." });
      }
    }

    if (body.role_id && Number(body.role_id) !== Number(target.role_id) && target.role_code === "SYSTEM_ADMIN" && (target.is_active === true || target.is_active === 1)) {
      const activeAdmins = await countActiveSystemAdministratorsDb(pool);
      if (activeAdmins <= 1) {
        return res.status(400).json({ message: "The last active System Administrator cannot be assigned another role." });
      }
    }

    const user = await updateUserDb(pool, req.params.id, body, getCurrentUserEmail(req));
    req.auditEntityId = user.id;
    res.json(user);
  } catch (error) {
    sendAdminError(res, error, "Failed to update user.");
  }
});

app.patch("/api/admin/users/:id/status", requirePermission("users.activate"), async (req, res) => {
  try {
    const body = validateBody(userStatusSchema, req.body, res);
    if (!body) return;
    const target = await getUserByIdDb(pool, req.params.id);
    if (!target) return res.status(404).json({ message: "User not found." });
    if (target.role_code === "SYSTEM_ADMIN" && !isSystemAdministrator(getCurrentUser(req))) {
      return res.status(403).json({ message: "Only a System Administrator can activate or deactivate another System Administrator." });
    }

    if (Number(getCurrentUser(req).id) === Number(target.id) && body.is_active === false) {
      return res.status(400).json({ message: "You cannot deactivate your own account." });
    }
    if (target.role_code === "SYSTEM_ADMIN" && body.is_active === false && (target.is_active === true || target.is_active === 1)) {
      const activeAdmins = await countActiveSystemAdministratorsDb(pool);
      if (activeAdmins <= 1) {
        return res.status(400).json({ message: "The last active System Administrator cannot be deactivated." });
      }
    }

    const user = await setUserActiveDb(pool, target.id, body.is_active, getCurrentUserEmail(req));
    req.auditEntityId = user.id;
    res.json(user);
  } catch (error) {
    sendAdminError(res, error, "Failed to update user status.");
  }
});

app.post("/api/admin/users/:id/reset-password", requirePermission("users.reset_password"), async (req, res) => {
  try {
    const body = validateBody(resetPasswordSchema, req.body, res);
    if (!body) return;
    const target = await getUserByIdDb(pool, req.params.id);
    if (!target) return res.status(404).json({ message: "User not found." });
    if (target.role_code === "SYSTEM_ADMIN" && !isSystemAdministrator(getCurrentUser(req))) {
      return res.status(403).json({ message: "Only a System Administrator can reset another System Administrator's password." });
    }
    if (String(target.auth_provider || "local").toLowerCase() !== "local") {
      return res.status(400).json({ message: "Microsoft AD passwords must be managed through Microsoft, not this application." });
    }
    const temporaryPassword = body.generate_password ? generateTemporaryPassword(16) : body.temporary_password;
    if (!temporaryPassword || temporaryPassword.length < 10) {
      return res.status(400).json({ message: "Provide a temporary password of at least 10 characters or request a generated password." });
    }
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);
    const user = await resetUserPasswordDb(pool, target.id, passwordHash, body.must_change_password, getCurrentUserEmail(req));
    req.auditEntityId = user.id;
    res.json({
      message: "Password reset successfully. Existing sessions were invalidated.",
      temporary_password: body.generate_password ? temporaryPassword : undefined,
      password_display_once: Boolean(body.generate_password),
      user,
    });
  } catch (error) {
    sendAdminError(res, error, "Failed to reset password.");
  }
});

app.put("/api/admin/users/:id/permissions", requirePermission("users.manage_permissions"), async (req, res) => {
  try {
    const body = validateBody(userPermissionOverridesSchema, req.body, res);
    if (!body) return;
    const target = await getUserByIdDb(pool, req.params.id);
    if (!target) return res.status(404).json({ message: "User not found." });
    if (target.role_code === "SYSTEM_ADMIN") {
      return res.status(400).json({ message: "System Administrators already have all permissions and cannot be restricted by overrides." });
    }
    if (!isSystemAdministrator(getCurrentUser(req))) {
      const invalidGrant = body.overrides.find((item) => item.is_allowed && !hasPermission(getCurrentUser(req), item.permission_code));
      if (invalidGrant) {
        return res.status(403).json({ message: `You cannot grant a permission you do not possess (${invalidGrant.permission_code}).` });
      }
    }
    const user = await setUserPermissionOverridesDb(pool, target.id, body.overrides);
    req.auditEntityId = user.id;
    res.json(user);
  } catch (error) {
    sendAdminError(res, error, "Failed to update user permissions.");
  }
});

app.get("/api/cases", requirePermission("cases.view"), async (req, res) => {
  try {
    const currentUserEmail = getCurrentUserEmail(req);
    const cases = await getCaseQueueDb(pool, currentUserEmail);

    res.json(cases);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch fraud cases",
      error: error.message,
    });
  }
});

app.patch("/api/cases/:id", requirePermission("cases.update"), async (req, res) => {
  try {
    const fraudCase = await findCaseByIdOrNumber(req.params.id);

    if (!fraudCase) return res.status(404).json({ message: "Case not found" });
    if (!canAccessCase(req, fraudCase)) return denyDraftAccess(res);

    const updatedBy = getCurrentUserEmail(req);
    const updatedCase = await updateFraudCaseDb(pool, fraudCase, req.body, updatedBy);

    res.json(updatedCase);
  } catch (error) {
    res.status(500).json({
      message: "Failed to update fraud case",
      error: error.message,
    });
  }
});




// Replace the existing POST /api/cases route with this full block:

app.post("/api/cases", requirePermission("cases.create"), async (req, res) => {
  try {
    const body = validateBody(createCaseSchema, req.body, res);
    if (!body) return;

    const createdBy = getCurrentUserEmail(req);
    const caseNumber = body.case_number || `FC-${Date.now()}`;
    const requestedStatus = emptyToNull(body.case_status) || "Draft";
    const allowedCreateStatuses = ["Draft", "Open", "Suspended", "Closed"];
    const createStatus = allowedCreateStatuses.includes(requestedStatus) ? requestedStatus : "Draft";

    if (createStatus === "Closed" && !body.closure_reason) {
      return res.status(400).json({ message: "Closure reason is required when creating a closed case." });
    }

    if (createStatus === "Suspended" && (!body.suspension_date || !body.suspension_reason)) {
      return res.status(400).json({
        message: "Suspension date and suspension reason are required when creating a suspended case.",
      });
    }

    const caseData = {
      case_number: caseNumber,
      reporter_name: emptyToNull(body.reporter_name),
      reporter_email: emptyToNull(body.reporter_email),
      reporter_mobile: emptyToNull(body.reporter_mobile),
      national_id_or_iqama: emptyToNull(body.national_id_or_iqama),
      consent_to_terms_and_privacy: Boolean(body.consent_to_terms_and_privacy),

      claim_id: emptyToNull(body.claim_id),
      case_type: emptyToNull(body.case_type),
      case_source: emptyToNull(body.case_source),
      case_source_other: emptyToNull(body.case_source_other),
      priority_level: emptyToNull(body.priority_level),
      case_status: createStatus,
      case_entry_date: body.case_entry_date || new Date(),
      insurance_type: emptyToNull(body.insurance_type),
      suspected_amount: toNumber(body.suspected_amount, 0),
      description: emptyToNull(body.description),

      has_claim: Boolean(body.has_claim),
      claim_type: emptyToNull(body.claim_type),
      suspension_date: createStatus === "Suspended" ? emptyToNull(body.suspension_date) : null,
      suspension_reason: createStatus === "Suspended" ? emptyToNull(body.suspension_reason) : null,

      fraud_confirmed_date: emptyToNull(body.fraud_confirmed_date),
      fraud_detection_method: emptyToNull(body.fraud_detection_method),
      fraud_amount: toNumber(body.fraud_amount, 0),
      action_taken: emptyToNull(body.action_taken),
      referred_entity: emptyToNull(body.referred_entity),
      fraud_indicator_type: emptyToNull(body.fraud_indicator_type),
      indicator_description: emptyToNull(body.indicator_description),
      occurrence_count: toNumber(body.occurrence_count, 0),
      risk_score: toNumber(body.risk_score, 0),
      risk_level: emptyToNull(body.risk_level),
      system_recommendation: emptyToNull(body.system_recommendation),

      fraud_unit_notes: emptyToNull(body.fraud_unit_notes),
      assigned_user: null,
      assignment_date: null,
      assigned_by: null,
      reassignment_reason: null,
      closure_date: createStatus === "Closed" ? new Date() : null,
      closure_reason: createStatus === "Closed" ? emptyToNull(body.closure_reason) : null,

      created_by: createdBy,
    };

    const fraudCase = await createFraudCaseDb(pool, caseData, body.documents, createdBy);
    req.auditEntityId = fraudCase.case_number || fraudCase.id;

    res.status(201).json(fraudCase);
  } catch (error) {
    res.status(500).json({
      message: "Failed to create fraud case",
      error: error.message,
    });
  }
});



app.get("/api/cases/:id", requirePermission("cases.view"), async (req, res) => {
  try {
    const fraudCase = await findCaseByIdOrNumber(req.params.id);

    if (!fraudCase) {
      return res.status(404).json({ message: "Case not found" });
    }

    if (!canAccessCase(req, fraudCase)) {
      return denyDraftAccess(res);
    }

    res.json(fraudCase);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch fraud case details",
      error: error.message,
    });
  }
});

async function saveCaseStepUpdate(req, res, schema, mapBody) {
  try {
    const existingCase = await requireCaseAccess(req, res, req.params.id);
    if (!existingCase) return;

    const body = validateBody(schema, req.body, res);
    if (!body) return;

    const updateBody = mapBody(body, existingCase);
    const updatedCase = await updateFraudCaseDb(
      pool,
      existingCase,
      updateBody,
      getCurrentUserEmail(req)
    );

    res.json(updatedCase);
  } catch (error) {
    res.status(500).json({
      message: "Failed to update fraud case",
      error: error.message,
    });
  }
}

app.patch("/api/cases/:id/reporter", requirePermission("cases.update"), async (req, res) => {
  return saveCaseStepUpdate(req, res, reporterSchema, (body) => ({
    reporter_name: emptyToNull(body.reporter_name),
    reporter_email: emptyToNull(body.reporter_email),
    reporter_mobile: emptyToNull(body.reporter_mobile),
    national_id_or_iqama: emptyToNull(body.national_id_or_iqama),
    consent_to_terms_and_privacy:
      typeof body.consent_to_terms_and_privacy === "boolean" ? body.consent_to_terms_and_privacy : undefined,
  }));
});

app.patch("/api/cases/:id/overview", requirePermission("cases.update"), async (req, res) => {
  return saveCaseStepUpdate(req, res, overviewSchema, (body) => ({
    claim_id: emptyToNull(body.claim_id),
    claim_type: emptyToNull(body.claim_type),
    case_type: emptyToNull(body.case_type),
    case_source: emptyToNull(body.case_source),
    case_source_other: emptyToNull(body.case_source_other),
    priority_level: emptyToNull(body.priority_level),
    case_entry_date: emptyToNull(body.case_entry_date),
    insurance_type: emptyToNull(body.insurance_type),
    suspected_amount: body.suspected_amount === undefined ? undefined : toNumber(body.suspected_amount, 0),
    description: emptyToNull(body.description),
    has_claim: typeof body.has_claim === "boolean" ? body.has_claim : undefined,
    fraud_unit_notes: emptyToNull(body.fraud_unit_notes),
  }));
});

app.patch("/api/cases/:id/indicators", requirePermission("cases.update"), async (req, res) => {
  return saveCaseStepUpdate(req, res, indicatorsSchema, (body) => ({
    fraud_confirmed_date: emptyToNull(body.fraud_confirmed_date),
    fraud_detection_method: emptyToNull(body.fraud_detection_method),
    fraud_amount: body.fraud_amount === undefined ? undefined : toNumber(body.fraud_amount, 0),
    action_taken: emptyToNull(body.action_taken),
    referred_entity: emptyToNull(body.referred_entity),
    fraud_indicator_type: emptyToNull(body.fraud_indicator_type),
    indicator_description: emptyToNull(body.indicator_description),
    occurrence_count: body.occurrence_count === undefined ? undefined : toNumber(body.occurrence_count, 0),
    risk_level: emptyToNull(body.risk_level),
  }));
});

// Backward-compatible endpoint used by older frontend versions.
app.patch("/api/cases/:id/confirmed-fraud", requirePermission("cases.update"), async (req, res) => {
  return saveCaseStepUpdate(req, res, confirmedFraudSchema, (body) => ({
    claim_type: emptyToNull(body.claim_type),
    fraud_confirmed_date: emptyToNull(body.fraud_confirmed_date),
    fraud_detection_method: emptyToNull(body.fraud_detection_method),
    fraud_amount: body.fraud_amount === undefined ? undefined : toNumber(body.fraud_amount, 0),
    action_taken: emptyToNull(body.action_taken),
    referred_entity: emptyToNull(body.referred_entity),
  }));
});

app.patch("/api/cases/:id/status", requirePermission("cases.change_status"), async (req, res) => {
  try {
    const currentCase = await requireCaseAccess(req, res, req.params.id);
    if (!currentCase) return;

    const body = validateBody(statusSchema, req.body, res);
    if (!body) return;

    const requestedStatus =
      body.case_status === "مفتوح"
        ? "Open"
        : body.case_status === "معلق"
          ? "Suspended"
          : body.case_status === "مغلق"
            ? "Closed"
            : body.case_status;

    if (!requestedStatus || !["Open", "Suspended", "Closed"].includes(requestedStatus)) {
      return res.status(400).json({ message: "Case status must be Open, Suspended, or Closed." });
    }

    if (requestedStatus === "Closed" && !body.closure_reason && !currentCase.closure_reason) {
      return res.status(400).json({ message: "Closure reason is required when closing a case." });
    }

    if (
      requestedStatus === "Suspended" &&
      ((!body.suspension_date && !currentCase.suspension_date) ||
        (!body.suspension_reason && !currentCase.suspension_reason))
    ) {
      return res.status(400).json({
        message: "Suspension date and suspension reason are required when suspending a case.",
      });
    }

    const updatedCase = await updateFraudCaseDb(
      pool,
      currentCase,
      {
        case_status: requestedStatus,
        closure_reason: requestedStatus === "Closed" ? emptyToNull(body.closure_reason) || currentCase.closure_reason : null,
        closure_date: requestedStatus === "Closed" ? body.closure_date || currentCase.closure_date || new Date() : null,
        suspension_date:
          requestedStatus === "Suspended"
            ? emptyToNull(body.suspension_date) || currentCase.suspension_date
            : currentCase.suspension_date,
        suspension_reason:
          requestedStatus === "Suspended"
            ? emptyToNull(body.suspension_reason) || currentCase.suspension_reason
            : currentCase.suspension_reason,
      },
      body.responsible_user || getCurrentUserEmail(req)
    );

    res.json(updatedCase);
  } catch (error) {
    res.status(500).json({ message: "Failed to update case status", error: error.message });
  }
});

app.patch("/api/cases/:id/assign", requirePermission("cases.assign"), async (req, res) => {
  try {
    const currentCase = await requireCaseAccess(req, res, req.params.id);
    if (!currentCase) return;

    const body = validateBody(assignmentSchema, req.body, res);
    if (!body) return;

    const assignedBy = body.assigned_by || getCurrentUserEmail(req);
    const updatedCase = await updateFraudCaseDb(
      pool,
      currentCase,
      {
        assigned_user: emptyToNull(body.assigned_user),
        assignment_date: new Date(),
        assigned_by: assignedBy,
        reassignment_reason: body.change_reason || "Case assigned",
      },
      assignedBy
    );

    res.json(updatedCase);
  } catch (error) {
    res.status(500).json({ message: "Failed to assign case", error: error.message });
  }
});

app.patch("/api/cases/:id/release-assignment", requirePermission("cases.assign"), async (req, res) => {
  try {
    const currentCase = await requireCaseAccess(req, res, req.params.id);
    if (!currentCase) return;

    const body = validateBody(releaseAssignmentSchema, req.body, res);
    if (!body) return;

    const releasedBy = body.released_by || getCurrentUserEmail(req);
    const updatedCase = await updateFraudCaseDb(
      pool,
      currentCase,
      {
        assigned_user: null,
        assignment_date: null,
        assigned_by: null,
        reassignment_reason: body.change_reason || "Assignment released",
      },
      releasedBy
    );

    res.json(updatedCase);
  } catch (error) {
    res.status(500).json({ message: "Failed to release assignment", error: error.message });
  }
});

app.get("/api/cases/:id/assignment-history", requirePermission("cases.view"), async (req, res) => {
  try {
    const fraudCase = await findCaseByIdOrNumber(req.params.id);

    if (!fraudCase) return res.status(404).json({ message: "Case not found" });
    if (!canAccessCase(req, fraudCase)) return denyDraftAccess(res);

    const history = await getCaseAssignmentHistoryDb(pool, fraudCase.id);

    res.json(history);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch assignment history", error: error.message });
  }
});

app.get("/api/cases/:id/action-log", requirePermission("cases.view"), async (req, res) => {
  try {
    const fraudCase = await findCaseByIdOrNumber(req.params.id);

    if (!fraudCase) return res.status(404).json({ message: "Case not found" });
    if (!canAccessCase(req, fraudCase)) return denyDraftAccess(res);

    const logs = await getCaseActionLogsDb(pool, fraudCase.id);

    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch action log", error: error.message });
  }
});

app.get("/api/cases/:id/documents", requirePermission("cases.download_documents"), async (req, res) => {
  try {
    const fraudCase = await findCaseByIdOrNumber(req.params.id);

    if (!fraudCase) return res.status(404).json({ message: "Case not found" });
    if (!canAccessCase(req, fraudCase)) return denyDraftAccess(res);

    const documents = await getCaseDocumentsDb(pool, fraudCase.id);

    res.json(documents);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch case documents", error: error.message });
  }
});

app.post("/api/cases/:id/upload-document", requirePermission("cases.upload_documents"), upload.single("document"), async (req, res) => {
  try {
    const fraudCase = await findCaseByIdOrNumber(req.params.id);

    if (!fraudCase) return res.status(404).json({ message: "Case not found" });
    if (!canAccessCase(req, fraudCase)) return denyDraftAccess(res);

    const validFileResponse = validateUploadedFile(req.file, res);
    if (validFileResponse) return validFileResponse;

    const validBody = validateBody(uploadDocumentBodySchema, req.body, res);
    if (!validBody) return;

    const safeName = sanitizeFileName(req.file.originalname);
    const category = validBody.category || "supporting_document";
    const uploadedBy = validBody.uploaded_by || getCurrentUserEmail(req);

    const document = await saveUploadedDocumentDb(
      pool,
      fraudCase.id,
      {
        file_name: safeName,
        file_type: req.file.mimetype || "application/octet-stream",
        file_size: req.file.size,
        file_data: req.file.buffer,
      },
      category,
      uploadedBy
    );

    res.status(201).json(document);
  } catch (error) {
    res.status(500).json({ message: "Failed to upload case document", error: error.message });
  }
});


app.get("/api/documents/:documentId/download", requirePermission("cases.download_documents"), async (req, res) => {
  try {
    const { documentId } = req.params;
    const document = await findDocumentByIdDb(pool, documentId);

    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    const relatedCase = await findCaseByIdOrNumber(String(document.fraud_case_id));
    if (!relatedCase) return res.status(404).json({ message: "Case not found for document" });
    if (!canAccessCase(req, relatedCase)) return denyDraftAccess(res);

    if (document.file_data) {
      const buffer = Buffer.isBuffer(document.file_data)
        ? document.file_data
        : Buffer.from(document.file_data);

      const fileName = sanitizeFileName(document.file_name || "document");

      res.setHeader("Content-Type", document.file_type || "application/octet-stream");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.setHeader("Content-Length", buffer.length);
      res.setHeader("Cache-Control", "private, no-store");
// nosemgrep: javascript.express.security.audit.xss.direct-response-write.direct-response-write
      return res.send(buffer);
    }

    // Backward compatibility only: old rows may still have a Supabase path or external URL.
    if (document.storage_path) {
      const supabase = getSupabaseClient();
      const bucket = getStorageBucket();

      const downloadResult = await supabase.storage
        .from(bucket)
        .download(document.storage_path);

      if (downloadResult.error) {
        return res.status(500).json({
          message: "Failed to download document from Supabase Storage",
          error: downloadResult.error.message,
        });
      }

      const arrayBuffer = await downloadResult.data.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const fileName = sanitizeFileName(document.file_name || "document");

      res.setHeader("Content-Type", document.file_type || "application/octet-stream");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.setHeader("Content-Length", buffer.length);
      res.setHeader("Cache-Control", "private, no-store");
// nosemgrep: javascript.express.security.audit.xss.direct-response-write.direct-response-write
      return res.send(buffer);
    }

    if (document.file_url) {
      return res.redirect(document.file_url);
    }

    return res.status(404).json({ message: "Document has no stored file data, storage path, or URL" });
  } catch (error) {
    res.status(500).json({ message: "Failed to download document", error: error.message });
  }
});


app.post("/api/cases/:id/documents", requirePermission("cases.upload_documents"), async (req, res) => {
  try {
    const fraudCase = await findCaseByIdOrNumber(req.params.id);

    if (!fraudCase) return res.status(404).json({ message: "Case not found" });
    if (!canAccessCase(req, fraudCase)) return denyDraftAccess(res);

    const body = validateBody(manualDocumentSchema, req.body, res);
    if (!body) return;

    const document = await saveManualDocumentDb(
      pool,
      fraudCase.id,
      body,
      getCurrentUserEmail(req)
    );

    res.status(201).json(document);
  } catch (error) {
    res.status(500).json({ message: "Failed to save case document", error: error.message });
  }
});


app.get("/api/cases/:id/export-pdf", requirePermission("cases.export_pdf"), async (req, res) => {
  try {
    const fraudCase = await findCaseByIdOrNumber(req.params.id);

    if (!fraudCase) return res.status(404).json({ message: "Case not found" });
    if (!canAccessCase(req, fraudCase)) return denyDraftAccess(res);

    const documentsResult = await pool.query(
      `
      SELECT *
      FROM case_documents
      WHERE fraud_case_id = $1::integer
      ORDER BY uploaded_at DESC
      `,
      [fraudCase.id]
    );

    const actionLogsResult = await pool.query(
      `
      SELECT *
      FROM case_action_logs
      WHERE fraud_case_id = $1::integer
      ORDER BY action_time DESC
      `,
      [fraudCase.id]
    );

    const doc = new PDFDocument({
      size: "A4",
      margin: 48,
      info: {
        Title: `Fraud Case Report - ${fraudCase.case_number}`,
        Author: "Fraud Management System",
      },
    });

    const fileName = `fraud-case-${fraudCase.case_number || fraudCase.id}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    doc.pipe(res);

    doc.font("Helvetica-Bold").fontSize(20).text("Fraud Case Report", { align: "center" });
    doc.moveDown(0.35);
    doc.font("Helvetica").fontSize(11).text(`Case Number: ${safePdfValue(fraudCase.case_number)}`, { align: "center" });
    doc.fontSize(9).text(`Generated At: ${formatPdfDateTime(new Date())}`, { align: "center" });
    doc.moveDown(1);

    addPdfSection(doc, "1. Reporter Details");
    addPdfField(doc, "Reporter Name", fraudCase.reporter_name);
    addPdfField(doc, "Email", fraudCase.reporter_email);
    addPdfField(doc, "Mobile Number", fraudCase.reporter_mobile);
    addPdfField(doc, "ID / Iqama Number", fraudCase.national_id_or_iqama);

    addPdfSection(doc, "2. Case Overview");
    addPdfField(doc, "Case Number", fraudCase.case_number);
    addPdfField(doc, "Case Entry Date", formatPdfDateTime(fraudCase.case_entry_date));
    addPdfField(doc, "Case Source", fraudCase.case_source);
    addPdfField(doc, "Other Case Source", fraudCase.case_source_other);
    addPdfField(doc, "Case Type", fraudCase.case_type);
    addPdfField(doc, "Priority Level", fraudCase.priority_level);
    addPdfField(doc, "Case Status", fraudCase.case_status);
    if (["Suspended", "معلق"].includes(fraudCase.case_status)) {
      addPdfField(doc, "Suspension Date", formatPdfDateTime(fraudCase.suspension_date));
      addPdfLongField(doc, "Suspension Reason", fraudCase.suspension_reason);
    }
    addPdfField(doc, "Insurance Type", fraudCase.insurance_type);
    addPdfField(doc, "Suspected Amount", fraudCase.suspected_amount);
    addPdfLongField(doc, "Description", fraudCase.description);

    if (fraudCase.has_claim) {
      addPdfSection(doc, "3. Related Claim");
      addPdfField(doc, "Claim Number", fraudCase.claim_id);
      addPdfField(doc, "Claim Type", fraudCase.claim_type);
    }

    const isFraudCase = ["Fraud Confirmed", "Fraud Suspected", "احتيال مؤكد", "اشتباه الاحتيال"].includes(fraudCase.case_type);
    if (isFraudCase) {
      addPdfSection(doc, "4. Fraud Indicators");
      addPdfField(doc, "Fraud Confirmed Date", formatPdfDateTime(fraudCase.fraud_confirmed_date));
      addPdfField(doc, "Fraud Detection Method", fraudCase.fraud_detection_method);
      addPdfField(doc, "Fraud Amount", fraudCase.fraud_amount);
      addPdfField(doc, "Action Taken", fraudCase.action_taken);
      addPdfField(doc, "Referred Entity", fraudCase.referred_entity);
      addPdfField(doc, "Fraud Indicator Type", fraudCase.fraud_indicator_type);
      addPdfLongField(doc, "Indicator Description", fraudCase.indicator_description);
      addPdfField(doc, "Occurrence Count", fraudCase.occurrence_count);
      addPdfField(doc, "Risk Level", fraudCase.risk_level || fraudCase.risk_score);
    }

    addPdfSection(doc, "5. Case Notes and Closure");
    addPdfLongField(doc, "Fraud Unit Notes", fraudCase.fraud_unit_notes);
    addPdfField(doc, "Closure Date", formatPdfDateTime(fraudCase.closure_date));
    addPdfLongField(doc, "Closure Reason", fraudCase.closure_reason);

    addPdfSection(doc, "6. Attachments");
    if (documentsResult.rows.length === 0) {
      doc.font("Helvetica").fontSize(10).text("No attachments found.");
    } else {
      documentsResult.rows.forEach((item, index) => {
        doc.font("Helvetica-Bold").fontSize(10).text(`Attachment ${index + 1}`);
        addPdfField(doc, "File Name", item.file_name);
        addPdfField(doc, "File Type", item.file_type);
        addPdfField(doc, "Category", item.category);
        addPdfField(doc, "File URL", item.file_url);
        addPdfField(doc, "Uploaded By", item.uploaded_by);
        addPdfField(doc, "Uploaded At", formatPdfDateTime(item.uploaded_at));
        doc.moveDown(0.5);
      });
    }

    addPdfSection(doc, "7. Action Log");
    if (actionLogsResult.rows.length === 0) {
      doc.font("Helvetica").fontSize(10).text("No action logs found.");
    } else {
      actionLogsResult.rows.forEach((item, index) => {
        doc.font("Helvetica-Bold").fontSize(10).text(`Log ${index + 1}`);
        addPdfField(doc, "Responsible User", item.responsible_user);
        addPdfField(doc, "Status", item.status);
        addPdfField(doc, "Time", formatPdfDateTime(item.action_time));
        doc.moveDown(0.5);
      });
    }

    doc.moveDown(1);
    doc.font("Helvetica").fontSize(9).text("Generated by Fraud Management System", { align: "center" });

    doc.end();
  } catch (error) {
    res.status(500).json({ message: "Failed to export case PDF", error: error.message });
  }
});



function assistantErrorMessage(language, english, arabic) {
  return language === "ar" ? arabic : english;
}

function calculateSuspensionDurationDays(value) {
  if (!value) return null;
  const start = new Date(value);
  if (Number.isNaN(start.getTime())) return null;
  const today = new Date();
  start.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((today.getTime() - start.getTime()) / 86400000));
}

function safeAssistantCase(fraudCase) {
  return {
    id: fraudCase.id,
    case_number: fraudCase.case_number,
    case_status: fraudCase.case_status,
    case_type: fraudCase.case_type,
    case_source: fraudCase.case_source_other || fraudCase.case_source,
    priority_level: fraudCase.priority_level,
    case_entry_date: fraudCase.case_entry_date,
    insurance_type: fraudCase.insurance_type,
    suspected_amount: fraudCase.suspected_amount,
    description: fraudCase.description,
    has_claim: fraudCase.has_claim === true || fraudCase.has_claim === 1,
    claim_id: fraudCase.claim_id,
    claim_type: fraudCase.claim_type,
    fraud_confirmed_date: fraudCase.fraud_confirmed_date,
    fraud_detection_method: fraudCase.fraud_detection_method,
    fraud_amount: fraudCase.fraud_amount,
    action_taken: fraudCase.action_taken,
    referred_entity: fraudCase.referred_entity,
    fraud_indicator_type: fraudCase.fraud_indicator_type,
    indicator_description: fraudCase.indicator_description,
    occurrence_count: fraudCase.occurrence_count,
    risk_level: fraudCase.risk_level,
    assigned_user: fraudCase.assigned_user,
    suspension_date: fraudCase.suspension_date,
    suspension_reason: fraudCase.suspension_reason,
    suspension_duration_days: calculateSuspensionDurationDays(fraudCase.suspension_date),
    closure_date: fraudCase.closure_date,
    closure_reason: fraudCase.closure_reason,
    fraud_unit_notes: fraudCase.fraud_unit_notes,
    created_at: fraudCase.created_at,
    updated_at: fraudCase.updated_at,
  };
}

app.post("/api/assistant/chat", requirePermission("assistant.use"), async (req, res) => {
  try {
    const body = validateBody(assistantChatSchema, req.body, res);
    if (!body) return;

    const currentUser = getCurrentUser(req);
    const language = body.language === "ar" || /[\u0600-\u06FF]/.test(body.message) ? "ar" : "en";
    const capabilities = {
      viewCaseStatus: hasPermission(currentUser, "assistant.view_case_status") && hasPermission(currentUser, "cases.view"),
      summarizeCases: hasPermission(currentUser, "assistant.summarize_cases") && hasPermission(currentUser, "cases.view"),
      viewAssignedCases: hasPermission(currentUser, "assistant.view_assigned_cases") && hasPermission(currentUser, "cases.view"),
      viewStatistics: hasPermission(currentUser, "assistant.view_operational_statistics") && hasPermission(currentUser, "dashboard.view"),
    };

    const findAuthorizedCase = async (reference) => {
      const fraudCase = await findCaseByIdOrNumber(reference);
      if (!fraudCase) {
        return { error: assistantErrorMessage(language, `Case ${reference} was not found.`, `لم يتم العثور على البلاغ ${reference}.`) };
      }
      if (!canAccessCase(req, fraudCase)) {
        return { error: assistantErrorMessage(language, "You are not allowed to access this draft case.", "ليس لديك صلاحية للوصول إلى هذه المسودة.") };
      }
      return fraudCase;
    };

    const tools = {
      getCaseStatus: async (reference) => {
        if (!capabilities.viewCaseStatus) return { error: assistantErrorMessage(language, "You do not have permission to view case status.", "ليس لديك صلاحية الاطلاع على حالة البلاغ.") };
        const fraudCase = await findAuthorizedCase(reference);
        if (fraudCase.error) return fraudCase;
        return safeAssistantCase(fraudCase);
      },
      getCaseSummary: async (reference) => {
        if (!capabilities.summarizeCases) return { error: assistantErrorMessage(language, "You do not have permission to summarize cases.", "ليس لديك صلاحية تلخيص البلاغات.") };
        const fraudCase = await findAuthorizedCase(reference);
        if (fraudCase.error) return fraudCase;
        const [history, documents] = await Promise.all([
          getCaseActionLogsDb(pool, fraudCase.id),
          getCaseDocumentsDb(pool, fraudCase.id),
        ]);
        return {
          ...safeAssistantCase(fraudCase),
          recent_history: history.slice(0, 5),
          document_count: documents.length,
        };
      },
      getMyAssignedCases: async (status) => {
        if (!capabilities.viewAssignedCases) return { error: assistantErrorMessage(language, "You do not have permission to view assigned cases.", "ليس لديك صلاحية الاطلاع على البلاغات المسندة.") };
        return { cases: await getAssignedCasesDb(pool, currentUser, status) };
      },
      getOperationalStatistics: async () => {
        if (!capabilities.viewStatistics) return { error: assistantErrorMessage(language, "You do not have permission to view operational statistics.", "ليس لديك صلاحية الاطلاع على الإحصائيات التشغيلية.") };
        return getDashboardSummaryDb(pool, getCurrentUserEmail(req));
      },
    };

    const result = await runAssistant({
      message: body.message,
      conversation: body.conversation,
      language,
      capabilities,
      tools,
    });

    const auditActions = {
      case_status: "ASSISTANT_CASE_STATUS_LOOKUP",
      case_summary: "ASSISTANT_CASE_SUMMARY",
      assigned_cases: "ASSISTANT_ASSIGNED_CASES_LOOKUP",
      operational_statistics: "ASSISTANT_OPERATIONAL_STATISTICS",
      guidance: "ASSISTANT_GUIDANCE_REQUEST",
      permission_denied: "ASSISTANT_ACCESS_DENIED",
      general_help: "ASSISTANT_GUIDANCE_REQUEST",
    };
    req.auditAssistantAction = auditActions[result.intent] || "ASSISTANT_QUESTION";
    req.auditEntityId = result.caseNumber || null;
    req.auditDetails = {
      intent: result.intent,
      provider: result.provider,
      language: result.language,
      case_number: result.caseNumber || null,
      duration_ms: null,
    };

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "The assistant could not process this request.", error: error.message });
  }
});


app.post("/api/fraud-assessments/export-all", requirePermission("fraud_assessment.view"), async (req, res) => {
  try {
    const answersByAssessmentCode = {};

    // Load all saved assessment sections from the database.
    for (const definition of Object.values(FRAUD_ASSESSMENTS)) {
      const assessment = await getFraudAssessmentDb(pool, definition.code);
      answersByAssessmentCode[definition.code] = assessment.answers || [];
    }

    // Include the answers currently visible in the browser even when the user
    // has not pressed Save Draft yet. Other sections come from their latest saved state.
    const currentCode = String(req.body?.current_assessment_code || "").trim();
    if (currentCode) {
      const definition = getFraudAssessmentDefinition(currentCode);
      if (!definition) {
        return res.status(400).json({ message: "Current fraud assessment section is invalid." });
      }

      const currentPayload = validateFraudAssessmentPayload(
        definition.code,
        { answers: req.body?.current_answers || [] },
        res
      );
      if (!currentPayload) return;
      answersByAssessmentCode[definition.code] = currentPayload.answers;
    }

    const workbook = buildAllFraudAssessmentsExcel(answersByAssessmentCode);
    req.auditEntityId = "ALL";
    req.auditDetails = {
      format: "xlsx",
      assessment_codes: Object.keys(FRAUD_ASSESSMENTS),
      current_assessment_code: currentCode || null,
    };

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="Fraud_Assessment_Complete.xlsx"');
    res.setHeader("Content-Length", workbook.length);
    return res.send(workbook);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to export the complete fraud assessment workbook.",
      error: error.message,
    });
  }
});

app.post("/api/fraud-assessments/:assessmentCode/export", requirePermission("fraud_assessment.view"), async (req, res) => {
  try {
    const definition = getFraudAssessmentDefinition(req.params.assessmentCode);
    if (!definition) {
      return res.status(404).json({ message: "Fraud assessment not found." });
    }

    const payload = validateFraudAssessmentPayload(definition.code, req.body, res);
    if (!payload) return;

    const workbook = buildFraudAssessmentExcel(definition.code, payload.answers);
    req.auditEntityId = definition.code;
    req.auditDetails = { answer_count: payload.answers.length, format: "xlsx" };

    const safeName = definition.title
      .replace(/^\d{2}\.\s*/, "")
      .replace(/&/g, "and")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="Fraud_Assessment_${definition.code}_${safeName}.xlsx"`);
    res.setHeader("Content-Length", workbook.length);
    return res.send(workbook);
  } catch (error) {
    const statusCode = Number(error.statusCode || 500);
    return res.status(statusCode).json({
      message: statusCode === 404 ? error.message : "Failed to export fraud assessment to Excel.",
      error: statusCode >= 500 ? error.message : undefined,
    });
  }
});

app.get("/api/fraud-assessments/:assessmentCode", requirePermission("fraud_assessment.view"), async (req, res) => {
  try {
    const definition = getFraudAssessmentDefinition(req.params.assessmentCode);
    if (!definition) {
      return res.status(404).json({ message: "Fraud assessment not found." });
    }
    const assessment = await getFraudAssessmentDb(pool, definition.code);
    return res.json(assessment);
  } catch (error) {
    const statusCode = Number(error.statusCode || 500);
    return res.status(statusCode).json({
      message: statusCode === 404 ? error.message : "Failed to fetch fraud assessment.",
      error: statusCode >= 500 ? error.message : undefined,
    });
  }
});

app.put("/api/fraud-assessments/:assessmentCode", requirePermission("fraud_assessment.edit"), async (req, res) => {
  try {
    const definition = getFraudAssessmentDefinition(req.params.assessmentCode);
    if (!definition) {
      return res.status(404).json({ message: "Fraud assessment not found." });
    }

    const payload = validateFraudAssessmentPayload(definition.code, req.body, res);
    if (!payload) return;

    const assessment = await saveFraudAssessmentDb(
      pool,
      definition.code,
      payload.answers,
      getCurrentUserEmail(req)
    );
    req.auditEntityId = definition.code;
    req.auditDetails = { answer_count: payload.answers.length, status: assessment.status };
    return res.json(assessment);
  } catch (error) {
    const statusCode = Number(error.statusCode || 500);
    return res.status(statusCode).json({
      message: statusCode === 404 ? error.message : "Failed to save fraud assessment.",
      error: statusCode >= 500 ? error.message : undefined,
    });
  }
});

app.post("/api/fraud-assessments/:assessmentCode/submit", requirePermission("fraud_assessment.submit"), async (req, res) => {
  try {
    const definition = getFraudAssessmentDefinition(req.params.assessmentCode);
    if (!definition) {
      return res.status(404).json({ message: "Fraud assessment not found." });
    }

    const payload = validateFraudAssessmentPayload(definition.code, req.body, res);
    if (!payload) return;

    const assessment = await submitFraudAssessmentDb(
      pool,
      definition.code,
      payload.answers,
      getCurrentUserEmail(req)
    );
    req.auditEntityId = definition.code;
    req.auditDetails = { answer_count: payload.answers.length, status: assessment.status };
    return res.json(assessment);
  } catch (error) {
    const statusCode = Number(error.statusCode || 500);
    return res.status(statusCode).json({
      message: statusCode === 404 ? error.message : "Failed to submit fraud assessment.",
      error: statusCode >= 500 ? error.message : undefined,
    });
  }
});

app.get("/api/audit-logs", requirePermission("audit.view"), async (req, res) => {
  try {
    const rows = await getAuditLogsDb(pool, {
      limit: req.query.limit,
      action: req.query.action,
      actor: req.query.actor,
      entityType: req.query.entityType,
    });
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch audit logs", error: error.message });
  }
});


app.get("/api/reports/fraud-cases", requirePermission("reports.view"), async (req, res) => {
  try {
    const rows = await getFraudCasesReportDb(pool);
    res.json(rows);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch fraud cases report",
      error: error.message,
    });
  }
});

app.get("/api/reports/confirmed-fraud", requirePermission("reports.view"), async (req, res) => {
  try {
    const rows = await getConfirmedFraudReportDb(pool);
    res.json(rows);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch confirmed fraud report",
      error: error.message,
    });
  }
});

app.get("/api/reports/fraud-indicators", requirePermission("reports.view"), async (req, res) => {
  try {
    const rows = await getFraudIndicatorsReportDb(pool);
    res.json(rows);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch fraud indicators report",
      error: error.message,
    });
  }
});

async function handleSuspendedFraudReport(req, res) {
  try {
    const rows = await getSuspendedFraudReportDb(pool);
    res.json(rows);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch suspended fraud report",
      error: error.message,
    });
  }
}

app.get("/api/reports/suspended-fraud", requirePermission("reports.view"), handleSuspendedFraudReport);
app.get("/api/reports/suspended-claims", requirePermission("reports.view"), handleSuspendedFraudReport);

app.get("/api/reports/fraud-performance", requirePermission("reports.view"), async (req, res) => {
  try {
    const rows = await getFraudPerformanceReportDb(pool);
    res.json(rows);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch fraud performance report",
      error: error.message,
    });
  }
});

app.get("/api/dashboard/summary", requirePermission("dashboard.view"), async (req, res) => {
  try {
    const currentUserEmail = getCurrentUserEmail(req);
    const summary = await getDashboardSummaryDb(pool, currentUserEmail);

    res.json(summary);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch dashboard summary",
      error: error.message,
    });
  }
});

app.use((error, req, res, next) => {
  if (error && error.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      message: "The selected file is too large. Maximum allowed file size is 15 MB.",
      message_ar: "حجم الملف المحدد كبير جدًا. الحد الأقصى المسموح به هو 15 ميجابايت.",
    });
  }

  if (error) {
    return res.status(500).json({
      message: "Unexpected server error.",
      error: error.message,
    });
  }

  return next();
});

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await ensureAuditSchemaDb(pool);
    await ensureFraudAssessmentSchemaDb(pool);
    await ensureMotorFraudSchemaDb(pool);
    await ensureRbacSchemaDb(pool);
    await bootstrapLocalAuthUsers();
    await ensureRbacSchemaDb(pool);

    app.listen(PORT, () => {
      console.log(`Fraud backend running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start fraud backend", error);
    process.exit(1);
  }
}

startServer();
