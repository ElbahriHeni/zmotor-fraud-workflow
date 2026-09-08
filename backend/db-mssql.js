const sql = require("mssql");

function requiredEnv(name, options = {}) {
  const { trim = true } = options;
  const rawValue = process.env[name];

  if (rawValue === undefined || rawValue === null) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  const value = String(rawValue);

  if (trim) {
    const trimmed = value.trim();

    if (!trimmed) {
      throw new Error(`Environment variable ${name} cannot be empty.`);
    }

    return trimmed;
  }

  if (value.length === 0) {
    throw new Error(`Environment variable ${name} cannot be empty.`);
  }

  return value;
}

function envBoolean(name, defaultValue) {
  const value = process.env[name];

  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  return String(value).trim().toLowerCase() === "true";
}

function envNumber(name, defaultValue) {
  const value = process.env[name];

  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(
      `Environment variable ${name} must be a valid number.`
    );
  }

  return parsed;
}

function buildConfig() {
  const port = envNumber("MSSQL_PORT", 1433);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("MSSQL_PORT must be a valid TCP port.");
  }

  return {
    server: requiredEnv("MSSQL_HOST"),
    port,
    database: requiredEnv("MSSQL_DATABASE"),
    user: requiredEnv("MSSQL_USER"),

    // Do NOT trim passwords. Spaces can legally be part of a password.
    password: requiredEnv("MSSQL_PASSWORD", { trim: false }),

    options: {
      encrypt: envBoolean("MSSQL_ENCRYPT", false),
      trustServerCertificate: envBoolean(
        "MSSQL_TRUST_SERVER_CERTIFICATE",
        true
      ),
    },

    pool: {
      max: envNumber("MSSQL_POOL_MAX", 10),
      min: envNumber("MSSQL_POOL_MIN", 0),
      idleTimeoutMillis: envNumber(
        "MSSQL_IDLE_TIMEOUT_MS",
        30000
      ),
    },

    connectionTimeout: envNumber(
      "MSSQL_CONNECTION_TIMEOUT_MS",
      15000
    ),

    requestTimeout: envNumber(
      "MSSQL_REQUEST_TIMEOUT_MS",
      30000
    ),
  };
}

let activePool = null;
let connectingPromise = null;

async function createPool() {
  const config = buildConfig();
  const candidatePool = new sql.ConnectionPool(config);

  candidatePool.on("error", (error) => {
    console.error(
      "MSSQL connection pool error:",
      error.code || "",
      error.message
    );

    if (activePool === candidatePool && !candidatePool.connected) {
      activePool = null;
    }
  });

  try {
    const connectedPool = await candidatePool.connect();
    return connectedPool;
  } catch (error) {
    // Critical:
    // never keep a failed connection/promise cached.
    try {
      await candidatePool.close();
    } catch {
      // Ignore cleanup errors.
    }

    throw error;
  }
}

async function getPool() {
  if (activePool && activePool.connected) {
    return activePool;
  }

  if (activePool && !activePool.connected) {
    try {
      await activePool.close();
    } catch {
      // Ignore cleanup errors.
    }

    activePool = null;
  }

  if (!connectingPromise) {
    connectingPromise = createPool()
      .then((pool) => {
        activePool = pool;
        connectingPromise = null;
        return pool;
      })
      .catch((error) => {
        // This is the important fix.
        // A failed SQL login must NOT poison all future attempts.
        activePool = null;
        connectingPromise = null;
        throw error;
      });
  }

  return connectingPromise;
}

async function closePool() {
  if (connectingPromise) {
    try {
      await connectingPromise;
    } catch {
      // A failed connection does not need closing.
    }

    connectingPromise = null;
  }

  if (activePool) {
    const poolToClose = activePool;
    activePool = null;

    try {
      await poolToClose.close();
    } catch (error) {
      console.error(
        "Failed to close MSSQL connection pool:",
        error.message
      );
    }
  }
}

// Keep this export for compatibility with any existing code that imports
// db-mssql.config. The authoritative connection configuration is still
// rebuilt whenever a new pool is created.
const config = buildConfig();

module.exports = {
  sql,
  getPool,
  closePool,
  config,
  buildConfig,
};