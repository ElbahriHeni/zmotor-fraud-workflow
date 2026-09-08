require("dotenv").config();

const dbType = (process.env.DB_TYPE || "postgres").trim().toLowerCase();

function isMssql() {
  return dbType === "mssql";
}

async function findCaseByIdOrNumberDb(pool, id, client = pool) {
  const lookupValue = String(id || "").trim();

  if (isMssql()) {
    const { sql, getPool } = require("./db-mssql");
    const db = await getPool();

    const result = await db
      .request()
      .input("lookupValue", sql.NVarChar(100), lookupValue)
      .query(`
        SELECT TOP 1 *
        FROM dbo.fraud_cases
        WHERE CONVERT(NVARCHAR(100), id) = @lookupValue
           OR case_number = @lookupValue
      `);

    return result.recordset[0] || null;
  }

  const result = await client.query(
    `
    SELECT *
    FROM fraud_cases
    WHERE id::text = $1::text OR case_number = $1::text
    LIMIT 1
    `,
    [lookupValue]
  );

  return result.rows[0] || null;
}

module.exports = {
  findCaseByIdOrNumberDb,
};
