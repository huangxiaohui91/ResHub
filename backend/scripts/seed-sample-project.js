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

async function main() {
  const [[admin]] = await pool.query("SELECT id FROM user WHERE username = 'admin' LIMIT 1");
  if (!admin) throw new Error("Admin user not found. Run seed-admin.js first.");
  const [[proj]] = await pool.query("SELECT id FROM project WHERE code = 'ax' LIMIT 1");
  let projectId = proj ? proj.id : null;
  if (!projectId) {
    const [res] = await pool.query(
      "INSERT INTO project (code, name, description, created_by, created_at) VALUES (?,?,?,?,NOW())",
      ["ax", "示例项目AX", "示例项目用于验证接口", admin.id]
    );
    projectId = res.insertId;
    console.log("Project ax created with id", projectId);
  } else {
    console.log("Project ax already exists");
  }
  const [[member]] = await pool.query("SELECT id FROM project_member WHERE project_id = ? AND user_id = ? LIMIT 1", [projectId, admin.id]);
  if (!member) {
    await pool.query(
      "INSERT INTO project_member (project_id, user_id, project_role, joined_at) VALUES (?,?,?,NOW())",
      [projectId, admin.id, "manager"]
    );
    console.log("Admin added as manager to project ax");
  } else {
    console.log("Admin is already a member of project ax");
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e.stack || e.message || String(e));
  process.exit(1);
});
