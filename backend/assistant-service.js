const {
  detectLanguage,
  findGuidanceTopic,
  formatGuidance,
  getGeneralHelp,
} = require("./assistant-knowledge");

const STATUS_NAMES = {
  en: { Draft: "Draft", Open: "Open", Suspended: "Suspended", Closed: "Closed" },
  ar: { Draft: "مسودة", Open: "مفتوح", Suspended: "معلّق", Closed: "مغلق" },
};

function truncate(value, max = 1400) {
  const text = String(value || "").trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function matchCaseReference(value) {
  const text = String(value || "");
  const caseNumber = text.match(/\bFC[-_\s]?[A-Z0-9-]{4,}\b/i);
  if (caseNumber) return caseNumber[0].replace(/[_\s]+/g, "-").toUpperCase();

  const numeric = text.match(/(?:case|request|بلاغ|حالة)\s*(?:number|no\.?|رقم)?\s*#?\s*(\d{1,10})\b/i);
  return numeric ? numeric[1] : null;
}

function isContextualCaseFollowUp(message) {
  return /(this case|that case|the same case|same case|its status|summari[sz]e it|what about it|what about this|what about that|هذا البلاغ|ذلك البلاغ|نفس البلاغ|حالته|لخصه|لخّصه)/i.test(String(message || ""));
}

function extractCaseReference(message, conversation = []) {
  const currentReference = matchCaseReference(message);
  if (currentReference) return currentReference;

  // Reuse an earlier case only when the new message clearly refers back to it.
  // General questions must never inherit a stale case number from chat history.
  if (!isContextualCaseFollowUp(message)) return null;

  for (const item of [...conversation].slice(-8).reverse()) {
    const reference = matchCaseReference(item?.content || "");
    if (reference) return reference;
  }
  return null;
}

function isSummaryIntent(message) {
  return /(summari[sz]e|summary|brief|overview|لخص|لخّص|ملخص|خلاصة)/i.test(String(message || ""));
}

function isStatusIntent(message) {
  return /(status|state|current case|where is|حالة|وضع البلاغ)/i.test(String(message || ""));
}

function isAssignedIntent(message) {
  return /(assigned to me|my assigned|my cases|cases assigned|مسندة لي|المسندة لي|بلاغاتي|حالاتي)/i.test(String(message || ""));
}

function isStatisticsIntent(message) {
  return /(how many|count|statistics|stats|total cases|open cases|suspended cases|closed cases|عدد|إحصائيات|كم بلاغ|كم حالة)/i.test(String(message || ""));
}

function isIdentityIntent(message) {
  return /(who are you|what are you|introduce yourself|what can you do|how can you help|من أنت|من انت|ما أنت|ماذا تستطيع|كيف تساعدني)/i.test(String(message || ""));
}

function isGreetingIntent(message) {
  return /^(hello|hi|hey|good morning|good afternoon|good evening|مرحبا|مرحباً|السلام عليكم|صباح الخير|مساء الخير)[!?.،\s]*$/i.test(String(message || "").trim());
}

function isThanksIntent(message) {
  return /^(thanks|thank you|great|perfect|شكرا|شكراً|ممتاز)[!?.،\s]*$/i.test(String(message || "").trim());
}

function isBareCaseReferenceIntent(message, caseReference) {
  if (!caseReference) return false;
  const escapedReference = caseReference.replace(/[.*+?^${}()|[\]\\]/g, "\$&");
  const withoutReference = String(message || "").replace(new RegExp(escapedReference, "i"), "");
  const remainder = normalize(withoutReference)
    .replace(/\b(case|request|number|no|status|بلاغ|حالة|رقم)\b/gi, "")
    .replace(/[#?:.,،-]/g, "")
    .trim();
  return remainder.length === 0;
}

function identityAnswer(language) {
  if (language === "ar") {
    return [
      "أنا مساعد إدارة الاحتيال داخل هذا النظام.",
      "يمكنني شرح طريقة استخدام النظام، والتحقق من حالة بلاغ مصرح لك به، وتلخيص البلاغات، وعرض البلاغات المسندة لك، وإعطائك إحصائيات تشغيلية.",
      "أعمل بصلاحيات حسابك وللقراءة فقط، لذلك لا أنشئ البلاغات ولا أعدلها ولا أغير حالتها.",
    ].join("\n");
  }
  return [
    "I am the Fraud Management Assistant inside this application.",
    "I can explain how to use the system, check an authorized case status, summarize cases, show cases assigned to you, and provide operational counts.",
    "I use your permissions and remain read-only, so I cannot create, edit, assign, suspend, close, or delete a case.",
  ].join("\n");
}

function requestedStatus(message) {
  const text = normalize(message);
  if (/(suspended|معلق|معلّق)/i.test(text)) return "Suspended";
  if (/(closed|مغلق)/i.test(text)) return "Closed";
  if (/(open|مفتوح)/i.test(text)) return "Open";
  return "";
}

function formatDate(value, language = "en") {
  if (!value) return language === "ar" ? "غير متوفر" : "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(language === "ar" ? "ar-SA" : "en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

function labelStatus(status, language) {
  return STATUS_NAMES[language]?.[status] || status || (language === "ar" ? "غير محدد" : "Not specified");
}

function formatCaseStatus(data, language) {
  if (language === "ar") {
    const lines = [
      `البلاغ ${data.case_number} حالته الحالية: ${labelStatus(data.case_status, "ar")}.`,
      `الأولوية: ${data.priority_level || "غير محددة"}.`,
      `المستخدم المسؤول: ${data.assigned_user || "غير مسند"}.`,
      `تاريخ إدخال البلاغ: ${formatDate(data.case_entry_date, "ar")}.`,
    ];
    if (data.case_status === "Suspended") {
      lines.push(`تاريخ التعليق: ${formatDate(data.suspension_date, "ar")}.`);
      lines.push(`سبب التعليق: ${data.suspension_reason || "غير مسجل"}.`);
      if (data.suspension_duration_days !== null && data.suspension_duration_days !== undefined) lines.push(`مدة التعليق: ${data.suspension_duration_days} يوم.`);
    }
    if (data.case_status === "Closed") {
      lines.push(`تاريخ الإغلاق: ${formatDate(data.closure_date, "ar")}.`);
      lines.push(`سبب الإغلاق: ${data.closure_reason || "غير مسجل"}.`);
    }
    return lines.join("\n");
  }

  const lines = [
    `Case ${data.case_number} is currently ${labelStatus(data.case_status, "en")}.`,
    `Priority: ${data.priority_level || "Not specified"}.`,
    `Assigned user: ${data.assigned_user || "Unassigned"}.`,
    `Case entry date: ${formatDate(data.case_entry_date, "en")}.`,
  ];
  if (data.case_status === "Suspended") {
    lines.push(`Suspension date: ${formatDate(data.suspension_date, "en")}.`);
    lines.push(`Suspension reason: ${data.suspension_reason || "Not recorded"}.`);
    if (data.suspension_duration_days !== null && data.suspension_duration_days !== undefined) lines.push(`Suspension duration: ${data.suspension_duration_days} day(s).`);
  }
  if (data.case_status === "Closed") {
    lines.push(`Closure date: ${formatDate(data.closure_date, "en")}.`);
    lines.push(`Closure reason: ${data.closure_reason || "Not recorded"}.`);
  }
  return lines.join("\n");
}

function formatCaseSummary(data, language) {
  const history = Array.isArray(data.recent_history) ? data.recent_history : [];
  if (language === "ar") {
    const lines = [
      `ملخص البلاغ ${data.case_number}`,
      "",
      `الحالة: ${labelStatus(data.case_status, "ar")}`,
      `نوع البلاغ: ${data.case_type || "غير محدد"}`,
      `المصدر: ${data.case_source || "غير محدد"}`,
      `الأولوية: ${data.priority_level || "غير محددة"}`,
      `نوع التأمين: ${data.insurance_type || "غير منطبق"}`,
      `المستخدم المسؤول: ${data.assigned_user || "غير مسند"}`,
      `تاريخ الإدخال: ${formatDate(data.case_entry_date, "ar")}`,
    ];
    if (data.has_claim) lines.push(`المطالبة المرتبطة: ${data.claim_id || "غير محددة"} — ${data.claim_type || "النوع غير محدد"}`);
    if (data.description) lines.push(`الوصف: ${truncate(data.description)}`);
    if (data.fraud_indicator_type || data.indicator_description) lines.push(`مؤشرات الاحتيال: ${truncate([data.fraud_indicator_type, data.indicator_description].filter(Boolean).join(" — "))}`);
    if (data.fraud_unit_notes) lines.push(`ملاحظات وحدة الاحتيال: ${truncate(data.fraud_unit_notes)}`);
    if (data.case_status === "Suspended") lines.push(`التعليق: ${formatDate(data.suspension_date, "ar")} — ${data.suspension_reason || "لم يسجل سبب"}`);
    if (data.case_status === "Closed") lines.push(`الإغلاق: ${formatDate(data.closure_date, "ar")} — ${data.closure_reason || "لم يسجل سبب"}`);
    lines.push(`عدد المرفقات: ${Number(data.document_count || 0)}`);
    if (history.length) {
      lines.push("آخر الإجراءات:");
      history.slice(0, 5).forEach((item) => lines.push(`• ${item.action_type || "إجراء"}: ${item.previous_status || "—"} ← ${item.new_status || item.status || "—"} (${formatDate(item.action_time, "ar")})`));
    }
    lines.push("", "تم استبعاد بيانات المبلّغ الشخصية من الملخص.");
    return lines.join("\n");
  }

  const lines = [
    `Case summary — ${data.case_number}`,
    "",
    `Status: ${labelStatus(data.case_status, "en")}`,
    `Case type: ${data.case_type || "Not specified"}`,
    `Source: ${data.case_source || "Not specified"}`,
    `Priority: ${data.priority_level || "Not specified"}`,
    `Insurance type: ${data.insurance_type || "Not Applicable"}`,
    `Assigned user: ${data.assigned_user || "Unassigned"}`,
    `Case entry date: ${formatDate(data.case_entry_date, "en")}`,
  ];
  if (data.has_claim) lines.push(`Related claim: ${data.claim_id || "Not specified"} — ${data.claim_type || "Type not specified"}`);
  if (data.description) lines.push(`Description: ${truncate(data.description)}`);
  if (data.fraud_indicator_type || data.indicator_description) lines.push(`Fraud indicators: ${truncate([data.fraud_indicator_type, data.indicator_description].filter(Boolean).join(" — "))}`);
  if (data.fraud_unit_notes) lines.push(`Fraud unit notes: ${truncate(data.fraud_unit_notes)}`);
  if (data.case_status === "Suspended") lines.push(`Suspension: ${formatDate(data.suspension_date, "en")} — ${data.suspension_reason || "No reason recorded"}`);
  if (data.case_status === "Closed") lines.push(`Closure: ${formatDate(data.closure_date, "en")} — ${data.closure_reason || "No reason recorded"}`);
  lines.push(`Attachments: ${Number(data.document_count || 0)}`);
  if (history.length) {
    lines.push("Recent activity:");
    history.slice(0, 5).forEach((item) => lines.push(`• ${item.action_type || "Action"}: ${item.previous_status || "—"} → ${item.new_status || item.status || "—"} (${formatDate(item.action_time, "en")})`));
  }
  lines.push("", "Personal reporter information was excluded from this summary.");
  return lines.join("\n");
}

function formatAssignedCases(rows, language) {
  if (!rows.length) return language === "ar" ? "لا توجد بلاغات مرسلة ومسندة لك ضمن المعايير المطلوبة." : "No submitted cases are assigned to you for the requested criteria.";
  const lines = language === "ar" ? ["البلاغات المسندة لك:"] : ["Cases assigned to you:"];
  rows.forEach((row) => {
    lines.push(`• ${row.case_number} — ${labelStatus(row.case_status, language)} — ${row.priority_level || "-"} — ${row.case_type || "-"}`);
  });
  if (rows.length >= 20) lines.push(language === "ar" ? "تم عرض أحدث 20 بلاغًا." : "Showing the 20 most recent cases.");
  return lines.join("\n");
}

function formatStatistics(data, language) {
  if (language === "ar") {
    return [
      "ملخص حالات البلاغات التي يمكنك الوصول إليها:",
      `• إجمالي البلاغات: ${Number(data.total_cases || 0)}`,
      `• المفتوحة: ${Number(data.open_cases || 0)}`,
      `• المعلقة: ${Number(data.suspended_claims || data.suspended_cases || 0)}`,
      `• المغلقة: ${Number(data.closed_cases || 0)}`,
      `• المسودات الخاصة بك: ${Number(data.my_draft_cases || 0)}`,
      `• البلاغات عالية الأولوية: ${Number(data.high_priority_cases || 0)}`,
    ].join("\n");
  }
  return [
    "Case status summary for the data you can access:",
    `• Total cases: ${Number(data.total_cases || 0)}`,
    `• Open: ${Number(data.open_cases || 0)}`,
    `• Suspended: ${Number(data.suspended_claims || data.suspended_cases || 0)}`,
    `• Closed: ${Number(data.closed_cases || 0)}`,
    `• Your drafts: ${Number(data.my_draft_cases || 0)}`,
    `• High priority: ${Number(data.high_priority_cases || 0)}`,
  ].join("\n");
}

async function runRulesAssistant({ message, conversation, language, capabilities, tools }) {
  if (isIdentityIntent(message)) return { answer: identityAnswer(language), intent: "general_help" };
  if (isGreetingIntent(message)) {
    return {
      answer: language === "ar" ? "مرحبًا. كيف يمكنني مساعدتك في نظام إدارة الاحتيال؟" : "Hello. How can I help you with the Fraud Management System?",
      intent: "general_help",
    };
  }
  if (isThanksIntent(message)) {
    return {
      answer: language === "ar" ? "على الرحب والسعة." : "You're welcome.",
      intent: "general_help",
    };
  }

  // Broad operational requests take priority over any case mentioned earlier in the chat.
  if (isAssignedIntent(message)) {
    if (!capabilities.viewAssignedCases) return { answer: language === "ar" ? "ليس لديك صلاحية الاطلاع على البلاغات المسندة." : "You do not have permission to view assigned cases.", intent: "permission_denied" };
    const data = await tools.getMyAssignedCases(requestedStatus(message));
    return { answer: data.error ? data.error : formatAssignedCases(data.cases || [], language), intent: "assigned_cases" };
  }

  if (isStatisticsIntent(message)) {
    if (!capabilities.viewStatistics) return { answer: language === "ar" ? "ليس لديك صلاحية الاطلاع على الإحصائيات التشغيلية." : "You do not have permission to view operational statistics.", intent: "permission_denied" };
    const data = await tools.getOperationalStatistics();
    return { answer: data.error ? data.error : formatStatistics(data, language), intent: "operational_statistics" };
  }

  const caseReference = extractCaseReference(message, conversation);

  if (isSummaryIntent(message)) {
    if (!caseReference) {
      return { answer: language === "ar" ? "اذكر رقم البلاغ الذي تريد تلخيصه، مثل FC-20260623-4625." : "Please provide the case number you want summarized, for example FC-20260623-4625.", intent: "general_help" };
    }
    if (!capabilities.summarizeCases) return { answer: language === "ar" ? "ليس لديك صلاحية تلخيص البلاغات." : "You do not have permission to summarize cases.", intent: "permission_denied" };
    const data = await tools.getCaseSummary(caseReference);
    return { answer: data.error ? data.error : formatCaseSummary(data, language), intent: "case_summary", caseNumber: data.case_number || caseReference };
  }

  if (isStatusIntent(message) || isBareCaseReferenceIntent(message, caseReference)) {
    if (!caseReference) {
      return { answer: language === "ar" ? "اذكر رقم البلاغ الذي تريد معرفة حالته، مثل FC-20260623-4625." : "Please provide the case number whose status you want to check, for example FC-20260623-4625.", intent: "general_help" };
    }
    if (!capabilities.viewCaseStatus) return { answer: language === "ar" ? "ليس لديك صلاحية الاطلاع على حالة البلاغ." : "You do not have permission to view case status.", intent: "permission_denied" };
    const data = await tools.getCaseStatus(caseReference);
    return { answer: data.error ? data.error : formatCaseStatus(data, language), intent: "case_status", caseNumber: data.case_number || caseReference };
  }

  const topic = findGuidanceTopic(message);
  if (topic) return { answer: formatGuidance(topic, language), intent: "guidance", topic: topic.key };

  if (caseReference) {
    return {
      answer: language === "ar"
        ? `هل تريد معرفة حالة البلاغ ${caseReference} أم تلخيصه؟`
        : `Would you like the status of case ${caseReference}, or a summary of it?`,
      intent: "general_help",
      caseNumber: caseReference,
    };
  }

  return { answer: getGeneralHelp(language), intent: "general_help" };
}

function extractOutputText(response) {
  if (typeof response?.output_text === "string" && response.output_text.trim()) return response.output_text.trim();
  const parts = [];
  for (const item of response?.output || []) {
    if (item.type !== "message") continue;
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) parts.push(content.text);
      else if (typeof content.text === "string") parts.push(content.text);
    }
  }
  return parts.join("\n").trim();
}

function buildOpenAiTools(capabilities) {
  const tools = [
    {
      type: "function",
      name: "get_application_guidance",
      description: "Get authoritative in-application guidance about creating cases, statuses, documents, reports, assignments, queue filters, users, roles, or password resets.",
      parameters: {
        type: "object",
        properties: { topic: { type: "string", description: "The application topic the user needs help with." } },
        required: ["topic"],
        additionalProperties: false,
      },
      strict: true,
    },
  ];

  if (capabilities.viewCaseStatus) tools.push({
    type: "function", name: "get_case_status", description: "Get the current status and status-specific dates/reasons for one authorized fraud case.",
    parameters: { type: "object", properties: { case_number: { type: "string" } }, required: ["case_number"], additionalProperties: false }, strict: true,
  });
  if (capabilities.summarizeCases) tools.push({
    type: "function", name: "get_case_summary", description: "Get a safe read-only summary of one authorized fraud case. Personal reporter information is excluded.",
    parameters: { type: "object", properties: { case_number: { type: "string" } }, required: ["case_number"], additionalProperties: false }, strict: true,
  });
  if (capabilities.viewAssignedCases) tools.push({
    type: "function", name: "get_my_assigned_cases", description: "List submitted fraud cases assigned to the signed-in user.",
    parameters: { type: "object", properties: { status: { type: "string", enum: ["", "Open", "Suspended", "Closed"] } }, required: ["status"], additionalProperties: false }, strict: true,
  });
  if (capabilities.viewStatistics) tools.push({
    type: "function", name: "get_operational_statistics", description: "Get counts of open, suspended, closed, draft, total, and high-priority cases visible to the signed-in user.",
    parameters: { type: "object", properties: {}, required: [], additionalProperties: false }, strict: true,
  });
  return tools;
}

async function executeOpenAiTool(name, args, tools, language) {
  if (name === "get_application_guidance") {
    const topic = findGuidanceTopic(args.topic || "");
    return { text: topic ? formatGuidance(topic, language) : getGeneralHelp(language), intent: "guidance" };
  }
  if (name === "get_case_status") {
    const data = await tools.getCaseStatus(args.case_number);
    return { text: data.error || formatCaseStatus(data, language), data, intent: "case_status" };
  }
  if (name === "get_case_summary") {
    const data = await tools.getCaseSummary(args.case_number);
    return { text: data.error || formatCaseSummary(data, language), data, intent: "case_summary" };
  }
  if (name === "get_my_assigned_cases") {
    const data = await tools.getMyAssignedCases(args.status || "");
    return { text: data.error || formatAssignedCases(data.cases || [], language), data, intent: "assigned_cases" };
  }
  if (name === "get_operational_statistics") {
    const data = await tools.getOperationalStatistics();
    return { text: data.error || formatStatistics(data, language), data, intent: "operational_statistics" };
  }
  return { text: language === "ar" ? "الأداة المطلوبة غير متاحة." : "The requested tool is unavailable.", intent: "tool_error" };
}

async function callOpenAi(payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.ASSISTANT_TIMEOUT_MS || 30000));
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.error?.message || `OpenAI API returned ${response.status}.`);
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

async function runOpenAiAssistant({ message, conversation, language, capabilities, tools }) {
  const model = process.env.OPENAI_MODEL || "gpt-5.5";
  const modelTools = buildOpenAiTools(capabilities);
  const input = [
    ...(conversation || []).slice(-10).map((item) => ({ role: item.role, content: truncate(item.content, 3000) })),
    { role: "user", content: message },
  ];
  const instructions = [
    "You are the read-only intelligent assistant inside an enterprise Fraud Management System.",
    "Answer in the user's language. Be concise, factual, and operationally useful.",
    "Use the supplied tools for all live case data and statistics. Never invent a case, status, count, permission, date, or reason.",
    "You cannot create, edit, assign, suspend, close, delete, or otherwise change a case.",
    "Do not reveal reporter email, phone number, national ID, passwords, tokens, or other personal credentials.",
    "If access is denied or data is unavailable, state that clearly.",
    "For application guidance, use get_application_guidance rather than relying on general knowledge.",
  ].join(" ");

  let response = await callOpenAi({ model, instructions, input, tools: modelTools, parallel_tool_calls: false });
  let lastIntent = "assistant_question";
  let lastCaseNumber = null;

  for (let iteration = 0; iteration < 3; iteration += 1) {
    const calls = (response.output || []).filter((item) => item.type === "function_call");
    if (!calls.length) break;

    input.push(...(response.output || []));
    for (const call of calls) {
      let args = {};
      try { args = JSON.parse(call.arguments || "{}"); } catch { args = {}; }
      const result = await executeOpenAiTool(call.name, args, tools, language);
      lastIntent = result.intent || lastIntent;
      lastCaseNumber = result.data?.case_number || lastCaseNumber;
      input.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify({ result: result.text }) });
    }

    response = await callOpenAi({ model, instructions, input, tools: modelTools, parallel_tool_calls: false });
  }

  const answer = extractOutputText(response);
  if (!answer) throw new Error("The model returned an empty response.");
  return { answer, intent: lastIntent, caseNumber: lastCaseNumber };
}

async function runAssistant(options) {
  const language = detectLanguage(options.message, options.language);
  const provider = String(process.env.ASSISTANT_PROVIDER || "rules").trim().toLowerCase();

  if (provider === "openai" && process.env.OPENAI_API_KEY) {
    try {
      const result = await runOpenAiAssistant({ ...options, language });
      return { ...result, language, provider: "openai", readOnly: true };
    } catch (error) {
      console.error("OpenAI assistant failed; using secure rules fallback:", error.message);
      const fallback = await runRulesAssistant({ ...options, language });
      return { ...fallback, language, provider: "rules-fallback", readOnly: true, warning: "AI provider was unavailable; a secure built-in answer was used." };
    }
  }

  const result = await runRulesAssistant({ ...options, language });
  return { ...result, language, provider: "rules", readOnly: true };
}

module.exports = {
  runAssistant,
  extractCaseReference,
};
