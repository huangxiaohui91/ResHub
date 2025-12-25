import bcrypt from "bcryptjs";
import { pool } from "../src/db.js";

const username = "c003";
const password = "c003123";
const realName = "员工003";
const systemRole = "super_admin";
const projectCode = "ax";
const projectRole = "viewer";

async function main() {
  const [[u]] = await pool.query("SELECT id FROM user WHERE username = ?", [username]);
  let userId = u?.id;
  if (!userId) {
    const hash = await bcrypt.hash(password, 10);
    const [res] = await pool.query(
      "INSERT INTO user (username, password_hash, real_name, system_role, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())",
      [username, hash, realName, systemRole]
    );
    userId = res.insertId;
    console.log(`created user ${username} id=${userId}`);
  } else {
    console.log(`user ${username} exists id=${userId}`);
  }
  const [[p]] = await pool.query("SELECT id FROM project WHERE code = ?", [projectCode]);
  if (!p) {
    throw new Error(`project ${projectCode} not found`);
  }
  const [[m]] = await pool.query("SELECT user_id FROM project_member WHERE user_id = ? AND project_id = ?", [userId, p.id]);
  if (!m) {
    await pool.query(
      "INSERT INTO project_member (user_id, project_id, project_role, joined_at) VALUES (?, ?, ?, NOW())",
      [userId, p.id, projectRole]
    );
    console.log(`added ${username} to project ${projectCode} as ${projectRole}`);
  } else {
    console.log(`member exists for ${username} in project ${projectCode}`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
