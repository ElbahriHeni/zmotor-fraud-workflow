const bcrypt = require("bcryptjs");
require("dotenv").config();

const dbType = (process.env.DB_TYPE || "postgres").trim().toLowerCase();

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isMssql() {
  return dbType === "mssql";
}

async function findActiveAppUserByEmailDb(pool, email) {
  const normalizedEmail = normalizeEmail(email);

  if (isMssql()) {
    const { sql, getPool } = require("./db-mssql");
    const db = await getPool();

    const result = await db
      .request()
      .input("email", sql.NVarChar(255), normalizedEmail)
      .query(`
        SELECT TOP 1 id, full_name, email, password_hash, role, is_active
        FROM app_users
        WHERE LOWER(email) = LOWER(@email)
      `);

    const user = result.recordset[0];

    if (!user || user.is_active === false || user.is_active === 0) {
      return null;
    }

    return user;
  }

  const result = await pool.query(
    `
    SELECT id, full_name, email, password_hash, role, is_active
    FROM app_users
    WHERE LOWER(email) = LOWER($1::text)
    LIMIT 1
    `,
    [normalizedEmail]
  );

  const user = result.rows[0];

  if (!user || user.is_active === false) {
    return null;
  }

  return user;
}

async function findActiveAppUserByIdDb(pool, id) {
  if (isMssql()) {
    const { sql, getPool } = require("./db-mssql");
    const db = await getPool();

    const result = await db
      .request()
      .input("id", sql.Int, Number(id))
      .query(`
        SELECT TOP 1 id, full_name, email, role, is_active
        FROM app_users
        WHERE id = @id
      `);

    const user = result.recordset[0];

    if (!user || user.is_active === false || user.is_active === 0) {
      return null;
    }

    return user;
  }

  const result = await pool.query(
    `
    SELECT id, full_name, email, role, is_active
    FROM app_users
    WHERE id = $1::integer
    LIMIT 1
    `,
    [id]
  );

  const user = result.rows[0];

  if (!user || user.is_active === false) {
    return null;
  }

  return user;
}

function parseLocalBootstrapUsers() {
  return String(process.env.LOCAL_AUTH_USERS || "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [email, fullName, role, password] = item
        .split("|")
        .map((part) => part.trim());

      return {
        email,
        fullName,
        role: role || "user",
        password,
      };
    })
    .filter((item) => item.email && item.fullName && item.password);
}

async function bootstrapLocalAuthUsersDb(pool) {
  if (process.env.LOCAL_AUTH_BOOTSTRAP !== "true") {
    return;
  }

  const users = parseLocalBootstrapUsers();

  if (users.length === 0) {
    console.warn("LOCAL_AUTH_BOOTSTRAP=true but LOCAL_AUTH_USERS is empty.");
    return;
  }

  const resetPasswords = process.env.LOCAL_AUTH_RESET_PASSWORDS === "true";

  if (isMssql()) {
    const { sql, getPool } = require("./db-mssql");
    const db = await getPool();

    for (const user of users) {
      const normalizedEmail = normalizeEmail(user.email);
      const passwordHash = await bcrypt.hash(user.password, 10);

      const existing = await db
        .request()
        .input("email", sql.NVarChar(255), normalizedEmail)
        .query(`
          SELECT TOP 1 id
          FROM app_users
          WHERE LOWER(email) = LOWER(@email)
        `);

      if (existing.recordset.length === 0) {
        await db
          .request()
          .input("fullName", sql.NVarChar(150), user.fullName)
          .input("email", sql.NVarChar(255), normalizedEmail)
          .input("passwordHash", sql.NVarChar(sql.MAX), passwordHash)
          .input("role", sql.NVarChar(50), user.role)
          .query(`
            INSERT INTO app_users (
              full_name,
              email,
              password_hash,
              role,
              is_active
            )
            VALUES (
              @fullName,
              @email,
              @passwordHash,
              @role,
              1
            )
          `);

        console.log(`Created local app user in MSSQL: ${normalizedEmail}`);
        continue;
      }

      if (resetPasswords) {
        await db
          .request()
          .input("fullName", sql.NVarChar(150), user.fullName)
          .input("passwordHash", sql.NVarChar(sql.MAX), passwordHash)
          .input("role", sql.NVarChar(50), user.role)
          .input("email", sql.NVarChar(255), normalizedEmail)
          .query(`
            UPDATE app_users
            SET full_name = @fullName,
                password_hash = @passwordHash,
                role = @role,
                is_active = 1,
                token_version = ISNULL(token_version, 0) + 1,
                updated_at = SYSUTCDATETIME()
            WHERE LOWER(email) = LOWER(@email)
          `);

        console.log(`Updated local app user and password in MSSQL: ${normalizedEmail}`);
      }
    }

    return;
  }

  for (const user of users) {
    const normalizedEmail = normalizeEmail(user.email);
    const passwordHash = await bcrypt.hash(user.password, 10);

    const existing = await pool.query(
      `SELECT id FROM app_users WHERE LOWER(email) = LOWER($1::text) LIMIT 1`,
      [normalizedEmail]
    );

    if (existing.rows.length === 0) {
      await pool.query(
        `
        INSERT INTO app_users (full_name, email, password_hash, role, is_active)
        VALUES ($1::text, $2::text, $3::text, $4::text, true)
        `,
        [user.fullName, normalizedEmail, passwordHash, user.role]
      );

      console.log(`Created local app user: ${normalizedEmail}`);
      continue;
    }

    if (resetPasswords) {
      await pool.query(
        `
        UPDATE app_users
        SET full_name = $1::text,
            password_hash = $2::text,
            role = $3::text,
            is_active = true,
            token_version = COALESCE(token_version, 0) + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE LOWER(email) = LOWER($4::text)
        `,
        [user.fullName, passwordHash, user.role, normalizedEmail]
      );

      console.log(`Updated local app user and password: ${normalizedEmail}`);
    }
  }
}

module.exports = {
  findActiveAppUserByEmailDb,
  findActiveAppUserByIdDb,
  bootstrapLocalAuthUsersDb,
};
