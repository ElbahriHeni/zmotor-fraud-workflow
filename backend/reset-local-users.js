require("dotenv").config();

process.env.LOCAL_AUTH_BOOTSTRAP = "true";
process.env.LOCAL_AUTH_RESET_PASSWORDS = "true";

const pool = require("./db");
const { bootstrapLocalAuthUsersDb } = require("./db-auth");
const { ensureRbacSchemaDb } = require("./db-rbac");

async function closeDatabase() {
  const dbType = (process.env.DB_TYPE || "postgres").trim().toLowerCase();

  if (dbType === "mssql") {
    const { closePool } = require("./db-mssql");
    await closePool();
    return;
  }

  if (pool && typeof pool.end === "function") {
    await pool.end();
  }
}

async function main() {
  try {
    await ensureRbacSchemaDb(pool);
    await bootstrapLocalAuthUsersDb(pool);
    await ensureRbacSchemaDb(pool);
    console.log("Configured local users were created or reset successfully.");
  } catch (error) {
    console.error("Failed to reset local users:", error.message);
    process.exitCode = 1;
  } finally {
    await closeDatabase().catch(() => {});
  }
}

main();
