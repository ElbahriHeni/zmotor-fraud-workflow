const { Pool } = require("pg");
require("dotenv").config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required when DB_TYPE=postgres.");
}

const usesSsl =
  connectionString.includes("sslmode=require") ||
  connectionString.includes("sslmode=verify-full") ||
  connectionString.includes("sslmode=verify-ca");

const pool = new Pool({
  connectionString,
  ssl: usesSsl
    ? {
        rejectUnauthorized: true,
      }
    : undefined,
});

module.exports = pool;