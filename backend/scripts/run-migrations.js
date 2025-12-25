import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";

for (const arg of process.argv.slice(2)) {
  const m = arg.match(/^--([^=]+)=(.*)$/);
  if (m) {
    const k = m[1].toUpperCase();
    const v = m[2];
    if (["DB_HOST","DB_PORT","DB_USER","DB_PASSWORD","DB_NAME"].includes(k)) process.env[k] = v;
  }
}
dotenv.config();
const { pool } = await import("../src/db.js");

const sqlPath = path.resolve(process.cwd(), "sql", "schema.sql");

async function main() {
  const sql = await fs.readFile(sqlPath, "utf8");
  const statements = sql
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const conn = await pool.getConnection();
  try {
    for (const s of statements) {
      await conn.query(s);
    }
    console.log("Migrations applied");
  } finally {
    conn.release();
  }
}

main().catch((e) => {
  if (e && e.errors && Array.isArray(e.errors)) {
    for (const er of e.errors) console.error(er.stack || er.message || String(er));
  } else {
    console.error(e.stack || e.message || String(e));
  }
  process.exit(1);
});
