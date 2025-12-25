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
import bcrypt from "bcryptjs";

async function main() {
  const password = "admin123";
  const hash = await bcrypt.hash(password, 10);
  const [[exists]] = await pool.query("SELECT id FROM user WHERE username = 'admin' LIMIT 1");
  if (!exists) {
    const [res] = await pool.query(
      "INSERT INTO user (username, password_hash, real_name, system_role, created_at, updated_at) VALUES (?,?,?,?,NOW(),NOW())",
      ["admin", hash, "系统管理员", "super_admin"]
    );
    console.log("Admin user created with id", res.insertId);
  } else {
    console.log("Admin user already exists");
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e.stack || e.message || String(e));
  process.exit(1);
});
