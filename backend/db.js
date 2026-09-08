const dbType = String(process.env.DB_TYPE || "")
  .trim()
  .toLowerCase();

if (!dbType) {
  throw new Error(
    "DB_TYPE is not configured. Set DB_TYPE=mssql or DB_TYPE=postgres in .env."
  );
}

if (dbType === "mssql") {
  module.exports = require("./db-mssql");
} else if (dbType === "postgres") {
  module.exports = require("./db-postgres");
} else {
  throw new Error(
    `Unsupported DB_TYPE '${dbType}'. Use 'mssql' or 'postgres'.`
  );
}