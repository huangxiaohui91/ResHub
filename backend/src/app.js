import Koa from "koa";
import Router from "koa-router";
import { koaBody } from "koa-body";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs/promises";
import { createReadStream } from "fs";
import crypto from "crypto";
import { pool } from "./db.js";
import bcrypt from "bcryptjs";

const cors = async (ctx, next) => {
  const origin = ctx.get("Origin") || "*";
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || "*").split(",");
  if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
      ctx.set("Access-Control-Allow-Origin", origin);
  }
  ctx.set("Access-Control-Allow-Credentials", "true");
  ctx.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  ctx.set("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Requested-With");
  // Basic Security Headers
  ctx.set("X-Content-Type-Options", "nosniff");
  ctx.set("X-Frame-Options", "DENY");
  ctx.set("X-XSS-Protection", "1; mode=block");
  
  if (ctx.method === "OPTIONS") {
    ctx.status = 204;
    return;
  }
  await next();
};

dotenv.config();

const app = new Koa();
const router = new Router({ prefix: "/api/v1" });

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_ROOT = path.resolve(process.env.STORAGE_LOCAL_ROOT || path.resolve(__dirname, "..", "..", "uploads"));

// Ensure temp dir exists
const TMP_DIR = path.join(process.cwd(), ".tmp");
fs.mkdir(TMP_DIR, { recursive: true }).catch(() => {});
// Ensure storage root exists (prevents runtime errors if directory was removed)
fs.mkdir(STORAGE_ROOT, { recursive: true }).catch(() => {});

const initDB = async () => {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS asset_project (
      asset_id INT NOT NULL,
      project_id INT NOT NULL,
      created_at DATETIME DEFAULT NOW(),
      PRIMARY KEY (asset_id, project_id)
    )`);
    console.log("DB Init: asset_project table checked/created.");
  } catch (e) {
    console.error("DB Init Error:", e);
  }
};
initDB();

app.use(async (ctx, next) => {
  console.log(`[${new Date().toISOString()}] ${ctx.method} ${ctx.url}`);
  try {
    await next();
  } catch (err) {
    console.error("Global Error:", err);
    ctx.status = err.status || 500;
    ctx.body = { code: ctx.status, message: err.message || "Server Error", data: null, timestamp: Date.now() };
  }
});

app.use(cors);

const parseBody = async (ctx, next) => {
  if (["POST", "PUT", "PATCH"].includes(ctx.method)) {
    const ct = (ctx.headers["content-type"] || "").toLowerCase();
    if (ct.includes("application/json")) {
      let data = "";
      await new Promise((resolve, reject) => {
        ctx.req.on("data", (c) => (data += c));
        ctx.req.on("end", resolve);
        ctx.req.on("error", reject);
      });
      try {
        ctx.request.body = JSON.parse(data || "{}");
      } catch (e) {
        ctx.throw(400, e.message || "Invalid JSON");
      }
    } else if (ct.includes("application/x-www-form-urlencoded")) {
      let data = "";
      await new Promise((resolve, reject) => {
        ctx.req.on("data", (c) => (data += c));
        ctx.req.on("end", resolve);
        ctx.req.on("error", reject);
      });
      const params = new URLSearchParams(data);
      const obj = {};
      for (const [k, v] of params.entries()) obj[k] = v;
      ctx.request.body = obj;
    }
  }
  await next();
};

app.use(parseBody);

const authRequired = async (ctx, next) => {
  let token = "";
  const header = ctx.headers["authorization"] || "";
  if (header.startsWith("Bearer ")) {
    token = header.slice(7);
  } else if (ctx.query && ctx.query.token) {
    token = ctx.query.token;
  }

  if (!token) {
    ctx.status = 401;
    ctx.body = { code: 401, message: "Unauthorized", data: null, timestamp: Date.now() };
    return;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    ctx.state.user = { id: payload.id, username: payload.username, system_role: payload.system_role };
  } catch (err) {
    console.error("Token verification failed:", err.message);
    ctx.status = 401;
    ctx.body = { code: 401, message: "Invalid token", data: null, timestamp: Date.now() };
    return;
  }
  await next();
};

const adminRequired = async (ctx, next) => {
  const user = ctx.state.user;
  if (!user || !["super_admin", "admin"].includes(user.system_role)) {
    ctx.status = 403;
    ctx.body = { code: 403, message: "forbidden", data: null, timestamp: Date.now() };
    return;
  }
  await next();
};

router.post("/auth/login", async (ctx) => {
  const { username, password } = ctx.request.body || {};
  const ip = ctx.ip || ctx.request.ip || "0.0.0.0";
  global.__login_attempts__ = global.__login_attempts__ || new Map();
  // Cleanup old attempts periodically (simple leak prevention)
  if (Math.random() < 0.01) { // 1% chance to cleanup on request
      const now = Date.now();
      for (const [k, v] of global.__login_attempts__.entries()) {
          if (now - v.first > 10 * 60 * 1000) global.__login_attempts__.delete(k);
      }
  }
  const key = `${ip}:${username || ""}`;
  const now = Date.now();
  const rec = global.__login_attempts__.get(key) || { count: 0, first: now };
  if (now - rec.first > 10 * 60 * 1000) {
    rec.count = 0;
    rec.first = now;
  }
  if (rec.count >= 5) {
    ctx.status = 429;
    ctx.body = { code: 429, message: "Too many login attempts", data: null, timestamp: Date.now() };
    return;
  }
  if (!username || !password) {
    ctx.status = 400;
    ctx.body = { code: 400, message: "Missing credentials", data: null, timestamp: Date.now() };
    return;
  }
  const [rows] = await pool.query("SELECT id, username, password_hash, real_name, system_role FROM user WHERE username = ?", [username]);
  if (!rows.length) {
    rec.count++;
    global.__login_attempts__.set(key, rec);
    ctx.status = 400;
    ctx.body = { code: 400, message: "Invalid username or password", data: null, timestamp: Date.now() };
    return;
  }
  const user = rows[0];
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    rec.count++;
    global.__login_attempts__.set(key, rec);
    ctx.status = 400;
    ctx.body = { code: 400, message: "Invalid username or password", data: null, timestamp: Date.now() };
    return;
  }
  global.__login_attempts__.set(key, { count: 0, first: now });
  const token = jwt.sign({ id: user.id, username: user.username, system_role: user.system_role }, JWT_SECRET, { expiresIn: "7d" });
  ctx.body = { code: 200, message: "OK", data: { token, userInfo: { id: user.id, username: user.username, realName: user.real_name, systemRole: user.system_role } }, timestamp: Date.now() };
});

router.get("/auth/me", authRequired, async (ctx) => {
  const userId = ctx.state.user.id;
  const [[user]] = await pool.query("SELECT id, username, real_name, system_role FROM user WHERE id = ?", [userId]);
  if (!user) {
    ctx.status = 404;
    ctx.body = { code: 404, message: "User not found", data: null, timestamp: Date.now() };
    return;
  }
  ctx.body = { code: 200, message: "OK", data: { id: user.id, username: user.username, realName: user.real_name, systemRole: user.system_role }, timestamp: Date.now() };
});

router.get("/admin/users", authRequired, adminRequired, async (ctx) => {
  const [rows] = await pool.query("SELECT id, username, real_name, system_role, email FROM user ORDER BY id DESC");
  ctx.body = { code: 200, message: "OK", data: rows, timestamp: Date.now() };
});

router.post("/admin/users", authRequired, adminRequired, async (ctx) => {
  const { username, password, realName, systemRole, email, projectCode, projectRole } = ctx.request.body || {};
  if (!username || !password || !systemRole) {
    ctx.status = 400;
    ctx.body = { code: 400, message: "username, password, systemRole required", data: null, timestamp: Date.now() };
    return;
  }
  const hash = await bcrypt.hash(String(password), 10);
  const [res] = await pool.query(
    "INSERT INTO user (username, password_hash, real_name, email, system_role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())",
    [String(username), hash, String(realName || ""), String(email || ""), String(systemRole)]
  );
  const userId = res.insertId;
  if (projectCode) {
    const [[p]] = await pool.query("SELECT id FROM project WHERE code = ?", [projectCode]);
    if (p) {
      await pool.query(
        "INSERT IGNORE INTO project_member (user_id, project_id, project_role, joined_at) VALUES (?, ?, ?, NOW())",
        [userId, p.id, String(projectRole || "viewer")]
      );
    }
  }
  ctx.body = { code: 200, message: "OK", data: { id: userId }, timestamp: Date.now() };
});

router.patch("/admin/users/:id", authRequired, adminRequired, async (ctx) => {
  const id = Number(ctx.params.id);
  const { realName, systemRole, email } = ctx.request.body || {};
  await pool.query("UPDATE user SET real_name = COALESCE(?, real_name), email = COALESCE(?, email), system_role = COALESCE(?, system_role), updated_at = NOW() WHERE id = ?", [
    realName || null,
    email || null,
    systemRole || null,
    id
  ]);
  ctx.body = { code: 200, message: "OK", data: null, timestamp: Date.now() };
});

router.delete("/admin/users/:id", authRequired, adminRequired, async (ctx) => {
  const id = Number(ctx.params.id);
  await pool.query("DELETE FROM user WHERE id = ?", [id]);
  ctx.body = { code: 200, message: "OK", data: null, timestamp: Date.now() };
});

router.get("/projects", authRequired, async (ctx) => {
  const userId = ctx.state.user.id;
  const [rows] = await pool.query(
    "SELECT p.id, p.code, p.name, pm.project_role AS role FROM project_member pm JOIN project p ON pm.project_id = p.id WHERE pm.user_id = ? ORDER BY p.id DESC",
    [userId]
  );
  ctx.body = { code: 200, message: "OK", data: rows, timestamp: Date.now() };
});

const ensureProjectAccess = async (user, projectCode) => {
  const [[project]] = await pool.query("SELECT id FROM project WHERE code = ?", [projectCode]);
  if (!project) return { allowed: false };
  
  // "library" project is open to all authenticated users as owner (effectively removing project barrier)
  if (projectCode === "library") {
    return { allowed: true, projectId: project.id, role: "owner" };
  }

  if (["super_admin", "admin"].includes(user.system_role)) {
    return { allowed: true, projectId: project.id, role: "owner" };
  }

  const [[member]] = await pool.query("SELECT project_role FROM project_member WHERE user_id = ? AND project_id = ?", [user.id, project.id]);
  if (!member) return { allowed: false };
  return { allowed: true, projectId: project.id, role: member.project_role };
};

const calcHash = (filePath) =>
  new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const s = createReadStream(filePath);
    s.on("data", (c) => hash.update(c));
    s.on("end", () => resolve(hash.digest("hex")));
    s.on("error", reject);
  });

const slugify = (s) =>
  String(s || "")
    .replace(/\.[^/.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const extractCategoryKey = (categoryPath) =>
  String(categoryPath || "")
    .split("/")
    .slice(-2)
    .join("_")
    .toLowerCase();

const formatTs = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
};

router.post(
  "/assets",
  authRequired,
  koaBody({
    multipart: true,
    formidable: { uploadDir: TMP_DIR, keepExtensions: true, maxFileSize: Number(process.env.MAX_UPLOAD_MB || 50) * 1024 * 1024 }
  }),
  async (ctx) => {
  const userId = ctx.state.user.id;
  const files = ctx.request.files || {};
  const file = files.file;
  const metaRaw = (ctx.request.body || {}).meta;
  if (!file || !metaRaw) {
    ctx.status = 400;
    ctx.body = { code: 400, message: "file and meta required", data: null, timestamp: Date.now() };
    return;
  }
  let meta;
  try {
    meta = JSON.parse(metaRaw);
  } catch {
    ctx.status = 400;
    ctx.body = { code: 400, message: "invalid meta", data: null, timestamp: Date.now() };
    return;
  }
  const { projectCode, categoryPath, displayName, tags, status, relatedProjectCodes } = meta;
  const access = await ensureProjectAccess(ctx.state.user, projectCode);
  if (!access.allowed || access.role === "viewer") {
    ctx.status = 403;
    ctx.body = { code: 403, message: "forbidden", data: null, timestamp: Date.now() };
    return;
  }
  const allowedExts = (process.env.ALLOWED_EXTS || "png,jpg,jpeg,gif,webp,svg,mp3,wav,ogg,gltf,glb,txt").split(",").map((s) => s.trim().toLowerCase());
  const ext = String(file.originalFilename || "").split(".").pop()?.toLowerCase() || "";
  if (!allowedExts.includes(ext)) {
    ctx.status = 400;
    ctx.body = { code: 400, message: "file type not allowed", data: null, timestamp: Date.now() };
    return;
  }
  const thumb = files.thumb;
  const safeCategory = String(categoryPath || "").replace(/(^|\/)\.\.(?=\/|$)/g, "").replace(/\/{2,}/g, "/");
  const fileHash = await calcHash(file.filepath || file.path);
  const [[existing]] = await pool.query(
    "SELECT id, storage_path FROM asset WHERE project_id = ? AND file_hash = ? AND status = 'approved' LIMIT 1",
    [access.projectId, fileHash]
  );
  const typeMap = { png: "tex", jpg: "tex", jpeg: "tex", wav: "sfx", mp3: "bgm" };
  const type = typeMap[ext] || "raw";
  const categoryKey = extractCategoryKey(safeCategory);
  const namePart = slugify(displayName || file.originalFilename || "asset");
  const ts = formatTs();
  const standardFilename = `${projectCode}_${type}_${categoryKey}_${namePart}_${ts}.${ext}`;
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const catParts = safeCategory ? safeCategory.split("/").filter(Boolean) : [];
  const relDir = path.join(projectCode, ...catParts, yyyy, mm, dd);
  const absDir = path.resolve(STORAGE_ROOT, relDir);
  await fs.mkdir(absDir, { recursive: true });
  const relPath = path.join(relDir, standardFilename);
  const absPath = path.resolve(STORAGE_ROOT, relPath);
  if (!existing) {
    await fs.copyFile(file.filepath || file.path, absPath);
  }
  let metaInfo = null;
  if (thumb) {
    const thumbName = `${projectCode}_${type}_${categoryKey}_${namePart}_${ts}.thumb.${ext === "svg" ? "svg" : "png"}`;
    const relThumbDir = path.join(projectCode, ...catParts, yyyy, mm, dd, "thumbs");
    const absThumbDir = path.resolve(STORAGE_ROOT, relThumbDir);
    await fs.mkdir(absThumbDir, { recursive: true });
    const relThumbPath = path.join(relThumbDir, thumbName).replace(/\\/g, "/");
    const absThumbPath = path.resolve(STORAGE_ROOT, relThumbPath);
    await fs.copyFile(thumb.filepath || thumb.path, absThumbPath);
    metaInfo = JSON.stringify({ thumb_path: relThumbPath });
  }
  const assetUid = `AST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const display_name = displayName || namePart;
  const [assetRes] = await pool.query(
    "INSERT INTO asset (asset_uid, original_filename, standard_filename, file_hash, file_size, file_ext, storage_path, display_name, category_path, project_id, uploader_id, current_version, status, meta_info, download_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW(), NOW())",
    [
      assetUid,
      file.originalFilename || "",
      standardFilename,
      fileHash,
      Number(file.size || 0),
      ext,
      existing ? existing.storage_path : relPath.replace(/\\/g, "/"),
      display_name,
      safeCategory || "",
      access.projectId,
      userId,
      1,
      status || "draft",
      metaInfo
    ]
  );
  const assetId = assetRes.insertId;
  await pool.query(
    "INSERT INTO asset_version (asset_id, version_number, file_hash, storage_path, uploader_id, change_log, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())",
    [assetId, 1, fileHash, existing ? existing.storage_path : relPath.replace(/\\/g, "/"), userId, ""]
  );
  // Insert into asset_project (Owner Project)
  await pool.query("INSERT IGNORE INTO asset_project (asset_id, project_id) VALUES (?, ?)", [assetId, access.projectId]);
  
  // Insert related projects
  let rpc = relatedProjectCodes;
  if (typeof rpc === "string") rpc = rpc.split(",");
  if (Array.isArray(rpc) && rpc.length) {
    for (const pCode of rpc) {
      const codeStr = String(pCode).trim();
      if (!codeStr || codeStr === projectCode) continue;
      const [[rp]] = await pool.query("SELECT id FROM project WHERE code = ?", [codeStr]);
      if (rp) {
         await pool.query("INSERT IGNORE INTO asset_project (asset_id, project_id) VALUES (?, ?)", [assetId, rp.id]);
      }
    }
  }

  if (Array.isArray(tags) && tags.length) {
    for (const tagName of tags) {
      const [[tag]] = await pool.query("SELECT id FROM tag WHERE name = ? AND project_id = ?", [String(tagName), access.projectId]);
      let tagId = tag ? tag.id : null;
      if (!tagId) {
        const [tagRes] = await pool.query(
          "INSERT INTO tag (name, project_id, color, created_by, created_at) VALUES (?, ?, ?, ?, NOW())",
          [String(tagName), access.projectId, "#409EFF", userId]
        );
        tagId = tagRes.insertId;
      }
      await pool.query("INSERT IGNORE INTO asset_tag (asset_id, tag_id, created_at) VALUES (?, ?, NOW())", [assetId, tagId]);
    }
  }
  const [[created]] = await pool.query("SELECT * FROM asset WHERE id = ?", [assetId]);
  ctx.body = { code: 200, message: "OK", data: created, timestamp: Date.now() };
}
);

router.patch("/assets/:id", authRequired, async (ctx) => {
  const userId = ctx.state.user.id;
  const id = Number(ctx.params.id);
  const [[asset]] = await pool.query("SELECT * FROM asset WHERE id = ?", [id]);
  if (!asset) {
    ctx.status = 404;
    ctx.body = { code: 404, message: "not found", data: null, timestamp: Date.now() };
    return;
  }
  const [[project]] = await pool.query("SELECT code FROM project WHERE id = ?", [asset.project_id]);
  const access = await ensureProjectAccess(ctx.state.user, project.code);
  if (!access.allowed || access.role === "viewer") {
    ctx.status = 403;
    ctx.body = { code: 403, message: "forbidden", data: null, timestamp: Date.now() };
    return;
  }
  const { displayName, categoryPath, status } = ctx.request.body || {};
  await pool.query("UPDATE asset SET display_name = COALESCE(?, display_name), category_path = COALESCE(?, category_path), status = COALESCE(?, status), updated_at = NOW() WHERE id = ?", [
    displayName || null,
    categoryPath || null,
    status || null,
    id
  ]);
  ctx.body = { code: 200, message: "OK", data: null, timestamp: Date.now() };
});

router.delete("/assets/:id", authRequired, async (ctx) => {
  const userId = ctx.state.user.id;
  const id = Number(ctx.params.id);
  const [[asset]] = await pool.query("SELECT * FROM asset WHERE id = ?", [id]);
  if (!asset) {
    ctx.status = 404;
    ctx.body = { code: 404, message: "not found", data: null, timestamp: Date.now() };
    return;
  }
  const [[project]] = await pool.query("SELECT code FROM project WHERE id = ?", [asset.project_id]);
  const access = await ensureProjectAccess(ctx.state.user, project.code);
  if (!access.allowed || access.role === "viewer") {
    ctx.status = 403;
    ctx.body = { code: 403, message: "forbidden", data: null, timestamp: Date.now() };
    return;
  }
  await pool.query("UPDATE asset SET status = 'archived', updated_at = NOW() WHERE id = ?", [id]);
  ctx.body = { code: 200, message: "OK", data: null, timestamp: Date.now() };
});

router.get("/assets/:id", authRequired, async (ctx) => {
  const userId = ctx.state.user.id;
  const id = Number(ctx.params.id);
  const [[asset]] = await pool.query("SELECT * FROM asset WHERE id = ?", [id]);
  if (!asset) {
    ctx.status = 404;
    ctx.body = { code: 404, message: "not found", data: null, timestamp: Date.now() };
    return;
  }
  const [[project]] = await pool.query("SELECT code FROM project WHERE id = ?", [asset.project_id]);
  const access = await ensureProjectAccess(ctx.state.user, project.code);
  if (!access.allowed) {
    ctx.status = 403;
    ctx.body = { code: 403, message: "forbidden", data: null, timestamp: Date.now() };
    return;
  }
  const [versions] = await pool.query("SELECT * FROM asset_version WHERE asset_id = ? ORDER BY version_number DESC", [id]);
  const [tags] = await pool.query(
    "SELECT t.name FROM tag t JOIN asset_tag at ON t.id = at.tag_id WHERE at.asset_id = ? ORDER BY t.name ASC",
    [id]
  );
  ctx.body = { code: 200, message: "OK", data: { asset, versions, tags: tags.map((t) => t.name) }, timestamp: Date.now() };
});

router.post("/assets/:id/approve", authRequired, async (ctx) => {
  const userId = ctx.state.user.id;
  const id = Number(ctx.params.id);
  const { comment } = ctx.request.body || {};
  const [[asset]] = await pool.query("SELECT * FROM asset WHERE id = ?", [id]);
  if (!asset) {
    ctx.status = 404;
    ctx.body = { code: 404, message: "not found", data: null, timestamp: Date.now() };
    return;
  }
  const [[project]] = await pool.query("SELECT code FROM project WHERE id = ?", [asset.project_id]);
  const access = await ensureProjectAccess(ctx.state.user, project.code);
  if (!access.allowed || access.role === "viewer") {
    ctx.status = 403;
    ctx.body = { code: 403, message: "forbidden", data: null, timestamp: Date.now() };
    return;
  }
  await pool.query("UPDATE asset SET status = 'approved', updated_at = NOW() WHERE id = ?", [id]);
  await pool.query(
    "INSERT INTO review_record (asset_id, applicant_id, reviewer_id, from_status, to_status, comment, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())",
    [id, asset.uploader_id, userId, asset.status, "approved", comment || null]
  );
  ctx.body = { code: 200, message: "OK", data: null, timestamp: Date.now() };
});

router.post("/assets/:id/reject", authRequired, async (ctx) => {
  const userId = ctx.state.user.id;
  const id = Number(ctx.params.id);
  const { comment } = ctx.request.body || {};
  const [[asset]] = await pool.query("SELECT * FROM asset WHERE id = ?", [id]);
  if (!asset) {
    ctx.status = 404;
    ctx.body = { code: 404, message: "not found", data: null, timestamp: Date.now() };
    return;
  }
  const [[project]] = await pool.query("SELECT code FROM project WHERE id = ?", [asset.project_id]);
  const access = await ensureProjectAccess(ctx.state.user, project.code);
  if (!access.allowed || access.role === "viewer") {
    ctx.status = 403;
    ctx.body = { code: 403, message: "forbidden", data: null, timestamp: Date.now() };
    return;
  }
  await pool.query("UPDATE asset SET status = 'rejected', updated_at = NOW() WHERE id = ?", [id]);
  await pool.query(
    "INSERT INTO review_record (asset_id, applicant_id, reviewer_id, from_status, to_status, comment, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())",
    [id, asset.uploader_id, userId, asset.status, "rejected", comment || null]
  );
  ctx.body = { code: 200, message: "OK", data: null, timestamp: Date.now() };
});

router.post(
  "/assets/:id/version",
  authRequired,
  koaBody({
    multipart: true,
    formidable: { uploadDir: TMP_DIR, keepExtensions: true }
  }),
  async (ctx) => {
    const userId = ctx.state.user.id;
    const id = Number(ctx.params.id);
    const [[asset]] = await pool.query("SELECT * FROM asset WHERE id = ?", [id]);
    if (!asset) {
      ctx.status = 404;
      ctx.body = { code: 404, message: "not found", data: null, timestamp: Date.now() };
      return;
    }
    const [[project]] = await pool.query("SELECT code FROM project WHERE id = ?", [asset.project_id]);
  const access = await ensureProjectAccess(ctx.state.user, project.code);
  if (!access.allowed || access.role === "viewer") {
      ctx.status = 403;
      ctx.body = { code: 403, message: "forbidden", data: null, timestamp: Date.now() };
      return;
    }
    const files = ctx.request.files || {};
    const file = files.file;
    const changeLog = (ctx.request.body || {}).changeLog || "";
    if (!file) {
      ctx.status = 400;
      ctx.body = { code: 400, message: "file required", data: null, timestamp: Date.now() };
      return;
    }
    const fileHash = await calcHash(file.filepath || file.path);
    const ext = String(file.originalFilename || "").split(".").pop()?.toLowerCase() || "";
    const ts = formatTs();
    const catParts = String(asset.category_path || "").split("/").filter(Boolean);
    const relDir = path.join(project.code, ...catParts, ts.slice(0, 4), ts.slice(4, 6), ts.slice(6, 8));
    const absDir = path.resolve(STORAGE_ROOT, relDir);
    await fs.mkdir(absDir, { recursive: true });
    const relPath = path.join(relDir, asset.standard_filename);
    const absPath = path.resolve(STORAGE_ROOT, relPath);
    await fs.copyFile(file.filepath || file.path, absPath);
    const [[last]] = await pool.query("SELECT MAX(version_number) AS v FROM asset_version WHERE asset_id = ?", [id]);
    const nextV = Number(last?.v || 1) + 1;
    await pool.query(
      "INSERT INTO asset_version (asset_id, version_number, file_hash, storage_path, uploader_id, change_log, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())",
      [id, nextV, fileHash, relPath.replace(/\\/g, "/"), userId, String(changeLog)]
    );
    await pool.query("UPDATE asset SET current_version = ?, updated_at = NOW() WHERE id = ?", [nextV, id]);
    ctx.body = { code: 200, message: "OK", data: { version: nextV }, timestamp: Date.now() };
  }
);

router.get("/tags", authRequired, async (ctx) => {
  const userId = ctx.state.user.id;
  const projectCode = ctx.query.projectCode;
  const access = await ensureProjectAccess(ctx.state.user, projectCode);
  if (!access.allowed) {
    ctx.status = 403;
    ctx.body = { code: 403, message: "forbidden", data: null, timestamp: Date.now() };
    return;
  }
  const [rows] = await pool.query("SELECT name FROM tag WHERE project_id = ? ORDER BY name ASC", [access.projectId]);
  ctx.body = { code: 200, message: "OK", data: rows.map((r) => r.name), timestamp: Date.now() };
});

router.get("/categories", authRequired, async (ctx) => {
  const userId = ctx.state.user.id;
  const projectCode = ctx.query.projectCode;
  const access = await ensureProjectAccess(ctx.state.user, projectCode);
  if (!access.allowed) {
    ctx.status = 403;
    ctx.body = { code: 403, message: "forbidden", data: null, timestamp: Date.now() };
    return;
  }
  const [rows] = await pool.query("SELECT * FROM category WHERE project_id = ? ORDER BY path ASC", [access.projectId]);
  ctx.body = { code: 200, message: "OK", data: rows, timestamp: Date.now() };
});

router.post("/categories", authRequired, adminRequired, async (ctx) => {
  const { projectCode, name, path: catPath, type, parentId } = ctx.request.body || {};
  if (!projectCode || !name || !catPath) {
    ctx.status = 400;
    ctx.body = { code: 400, message: "projectCode, name, path required", data: null, timestamp: Date.now() };
    return;
  }
  const [[p]] = await pool.query("SELECT id FROM project WHERE code = ?", [projectCode]);
  if (!p) {
    ctx.status = 400;
    ctx.body = { code: 400, message: "project not found", data: null, timestamp: Date.now() };
    return;
  }
  const [res] = await pool.query(
    "INSERT INTO category (project_id, name, path, type, parent_id, created_at) VALUES (?, ?, ?, ?, ?, NOW())",
    [p.id, String(name), String(catPath), String(type || "raw"), parentId ? Number(parentId) : null]
  );
  ctx.body = { code: 200, message: "OK", data: { id: res.insertId }, timestamp: Date.now() };
});

router.patch("/categories/:id", authRequired, adminRequired, async (ctx) => {
  const id = Number(ctx.params.id);
  const { name, path: catPath, type, parentId } = ctx.request.body || {};
  await pool.query("UPDATE category SET name = COALESCE(?, name), path = COALESCE(?, path), type = COALESCE(?, type), parent_id = COALESCE(?, parent_id) WHERE id = ?", [
    name || null,
    catPath || null,
    type || null,
    parentId ? Number(parentId) : null,
    id
  ]);
  ctx.body = { code: 200, message: "OK", data: null, timestamp: Date.now() };
});

router.delete("/categories/:id", authRequired, adminRequired, async (ctx) => {
  const id = Number(ctx.params.id);
  await pool.query("DELETE FROM category WHERE id = ?", [id]);
  ctx.body = { code: 200, message: "OK", data: null, timestamp: Date.now() };
});
router.get("/assets/:id/download", authRequired, async (ctx) => {
  const userId = ctx.state.user.id;
  const id = Number(ctx.params.id);
  const [[asset]] = await pool.query("SELECT * FROM asset WHERE id = ?", [id]);
  if (!asset) {
    ctx.status = 404;
    ctx.body = { code: 404, message: "not found", data: null, timestamp: Date.now() };
    return;
  }
  const [[project]] = await pool.query("SELECT code FROM project WHERE id = ?", [asset.project_id]);
  const access = await ensureProjectAccess(ctx.state.user, project.code);
  if (!access.allowed) {
    ctx.status = 403;
    ctx.body = { code: 403, message: "forbidden", data: null, timestamp: Date.now() };
    return;
  }
  const [[ver]] = await pool.query(
    "SELECT storage_path FROM asset_version WHERE asset_id = ? AND version_number = ?",
    [id, asset.current_version]
  );
  const relPath = ver?.storage_path || asset.storage_path;
  const absPath = path.resolve(STORAGE_ROOT, relPath);
  await pool.query("UPDATE asset SET download_count = download_count + 1 WHERE id = ?", [id]);
  ctx.set("Content-Type", "application/octet-stream");
  ctx.set("Content-Disposition", `attachment; filename="${asset.standard_filename}"`);
  ctx.body = createReadStream(absPath);
});

router.get("/assets/:id/reviews", authRequired, async (ctx) => {
  const userId = ctx.state.user.id;
  const id = Number(ctx.params.id);
  const [[asset]] = await pool.query("SELECT * FROM asset WHERE id = ?", [id]);
  if (!asset) {
    ctx.status = 404;
    ctx.body = { code: 404, message: "not found", data: null, timestamp: Date.now() };
    return;
  }
  const [[project]] = await pool.query("SELECT code FROM project WHERE id = ?", [asset.project_id]);
  const access = await ensureProjectAccess(ctx.state.user, project.code);
  if (!access.allowed) {
    ctx.status = 403;
    ctx.body = { code: 403, message: "forbidden", data: null, timestamp: Date.now() };
    return;
  }
  const [rows] = await pool.query(
    `SELECT r.*, a.username AS applicant_name, rv.username AS reviewer_name
     FROM review_record r
     LEFT JOIN user a ON r.applicant_id = a.id
     LEFT JOIN user rv ON r.reviewer_id = rv.id
     WHERE r.asset_id = ?
     ORDER BY r.id DESC`,
    [id]
  );
  ctx.body = { code: 200, message: "OK", data: rows, timestamp: Date.now() };
});

router.post("/assets/:id/reviews", authRequired, async (ctx) => {
  const userId = ctx.state.user.id;
  const id = Number(ctx.params.id);
  const { comment } = ctx.request.body || {};
  const [[asset]] = await pool.query("SELECT * FROM asset WHERE id = ?", [id]);
  if (!asset) {
    ctx.status = 404;
    ctx.body = { code: 404, message: "not found", data: null, timestamp: Date.now() };
    return;
  }
  const [[project]] = await pool.query("SELECT code FROM project WHERE id = ?", [asset.project_id]);
  const access = await ensureProjectAccess(ctx.state.user, project.code);
  if (!access.allowed) {
    ctx.status = 403;
    ctx.body = { code: 403, message: "forbidden", data: null, timestamp: Date.now() };
    return;
  }
  await pool.query(
    "INSERT INTO review_record (asset_id, applicant_id, reviewer_id, from_status, to_status, comment, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())",
    [id, asset.uploader_id, userId, asset.status, asset.status, comment || null]
  );
  ctx.body = { code: 200, message: "OK", data: null, timestamp: Date.now() };
});

router.get("/recent", authRequired, async (ctx) => {
  const userId = ctx.state.user.id;
  const projectCode = ctx.query.projectCode;
  const access = await ensureProjectAccess(ctx.state.user, projectCode);
  if (!access.allowed) {
    ctx.status = 403;
    ctx.body = { code: 403, message: "forbidden", data: null, timestamp: Date.now() };
    return;
  }
  const [rows] = await pool.query(
    `SELECT a.*, GROUP_CONCAT(DISTINCT t.name) AS tag_names
     FROM asset a
     LEFT JOIN asset_tag at ON a.id = at.asset_id
     LEFT JOIN tag t ON at.tag_id = t.id
     WHERE a.project_id = ? AND a.status = 'approved'
     GROUP BY a.id
     ORDER BY a.created_at DESC
     LIMIT 12`,
    [access.projectId]
  );
  ctx.body = { code: 200, message: "OK", data: rows, timestamp: Date.now() };
});

router.get("/hot-tags", authRequired, async (ctx) => {
  const userId = ctx.state.user.id;
  const projectCode = ctx.query.projectCode;
  const access = await ensureProjectAccess(ctx.state.user, projectCode);
  if (!access.allowed) {
    ctx.status = 403;
    ctx.body = { code: 403, message: "forbidden", data: null, timestamp: Date.now() };
    return;
  }
  const [rows] = await pool.query(
    `SELECT t.name, COUNT(*) AS count
     FROM asset_tag at
     JOIN tag t ON at.tag_id = t.id
     JOIN asset a ON at.asset_id = a.id
     WHERE a.project_id = ? AND a.status = 'approved'
     GROUP BY t.name
     ORDER BY COUNT(*) DESC
     LIMIT 20`,
    [access.projectId]
  );
  ctx.body = { code: 200, message: "OK", data: rows, timestamp: Date.now() };
});
router.get("/assets/:id/file", authRequired, async (ctx) => {
  const id = Number(ctx.params.id);
  const [[asset]] = await pool.query("SELECT * FROM asset WHERE id = ?", [id]);
  if (!asset) {
    ctx.status = 404;
    ctx.body = { code: 404, message: "not found", data: null, timestamp: Date.now() };
    return;
  }
  const [[project]] = await pool.query("SELECT code FROM project WHERE id = ?", [asset.project_id]);
  const access = await ensureProjectAccess(ctx.state.user, project.code);
  if (!access.allowed) {
    ctx.status = 403;
    ctx.body = { code: 403, message: "forbidden", data: null, timestamp: Date.now() };
    return;
  }
  const [[ver]] = await pool.query("SELECT storage_path FROM asset_version WHERE asset_id = ? AND version_number = ?", [id, asset.current_version]);
  let relPath = ver?.storage_path || asset.storage_path;
  if (String(ctx.query.thumb || "") === "1" && asset.meta_info) {
    try {
      const meta = JSON.parse(asset.meta_info);
      if (meta.thumb_path) relPath = meta.thumb_path;
    } catch {}
  }
  const relPathNorm = String(relPath).replace(/^[\\/]*uploads[\\/]/, "").replace(/\\/g, "/");
  const absPath = path.resolve(STORAGE_ROOT, relPathNorm);
  const ext = String(asset.file_ext || "").toLowerCase();
  const mimeMap = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    gltf: "model/gltf+json",
    glb: "model/gltf-binary",
    txt: "text/plain",
    unitypackage: "application/gzip"
  };
  const stat = await fs.stat(absPath);
  const range = ctx.headers["range"];
  if (range) {
    const m = String(range).match(/bytes=(\d+)-(\d*)/);
    const start = m ? Number(m[1]) : 0;
    const end = m && m[2] ? Number(m[2]) : stat.size - 1;
    const chunk = createReadStream(absPath, { start, end });
    ctx.status = 206;
    ctx.set("Content-Range", `bytes ${start}-${end}/${stat.size}`);
    ctx.set("Accept-Ranges", "bytes");
    ctx.set("Content-Length", String(end - start + 1));
    ctx.set("Content-Type", mimeMap[ext] || "application/octet-stream");
    ctx.body = chunk;
    return;
  }
  ctx.set("ETag", asset.file_hash || `"${relPath}"`);
  ctx.set("Last-Modified", stat.mtime.toUTCString());
  ctx.set("Cache-Control", "public, max-age=86400");
  ctx.set("Content-Length", String(stat.size));
  ctx.set("Content-Type", mimeMap[ext] || "application/octet-stream");
  ctx.body = createReadStream(absPath);
});
router.get("/assets", authRequired, async (ctx) => {
  const q = ctx.query || {};
  const projectCode = q.projectCode;
  const access = await ensureProjectAccess(ctx.state.user, projectCode);
  if (!access.allowed) {
    ctx.status = 403;
    ctx.body = { code: 403, message: "forbidden", data: null, timestamp: Date.now() };
    return;
  }
  const keyword = q.keyword ? `%${q.keyword}%` : null;
  const categoryLike = q.categoryPath ? `${q.categoryPath}%` : null;
  const status = q.status || null;
  const tagName = q.tag || null;
  const uploaderId = q.uploaderId ? Number(q.uploaderId) : null;
  const fileExt = q.fileExt ? String(q.fileExt).toLowerCase() : null;
  const minSize = q.minSize ? Number(q.minSize) : null;
  const maxSize = q.maxSize ? Number(q.maxSize) : null;
  const start = q.start ? String(q.start) : null;
  const end = q.end ? String(q.end) : null;
  const page = Number(q.page) || 1;
  const pageSize = Math.min(Number(q.pageSize) || 20, 100);
  const offset = (page - 1) * pageSize;
  const orderBy = String(q.orderBy || "id_desc");
  const orderSql =
    orderBy === "created_desc"
      ? "a.created_at DESC"
      : orderBy === "download_desc"
      ? "a.download_count DESC"
      : "a.id DESC";
  const [rows] = await pool.query(
    `SELECT a.*, u.real_name AS uploader_name,
            GROUP_CONCAT(DISTINCT t.name) AS tag_names
     FROM asset a
     LEFT JOIN user u ON a.uploader_id = u.id
     LEFT JOIN asset_tag at ON a.id = at.asset_id
     LEFT JOIN tag t ON at.tag_id = t.id
     LEFT JOIN asset_project ap ON a.id = ap.asset_id
     WHERE (a.project_id = ? OR ap.project_id = ?)
       AND (? IS NULL OR a.display_name LIKE ? OR a.standard_filename LIKE ?)
       AND (? IS NULL OR a.category_path LIKE ?)
       AND (? IS NULL OR a.status = ?)
       AND (? IS NULL OR EXISTS (SELECT 1 FROM asset_tag at2 JOIN tag t2 ON at2.tag_id = t2.id WHERE at2.asset_id = a.id AND t2.name = ?))
       AND (? IS NULL OR a.uploader_id = ?)
       AND (? IS NULL OR a.file_ext = ?)
       AND (? IS NULL OR a.file_size >= ?)
       AND (? IS NULL OR a.file_size <= ?)
       AND (? IS NULL OR a.created_at >= ?)
       AND (? IS NULL OR a.created_at <= ?)
     GROUP BY a.id
     ORDER BY ${orderSql}
     LIMIT ?, ?`,
    [
      access.projectId,
      access.projectId,
      keyword,
      keyword,
      keyword,
      categoryLike,
      categoryLike,
      status,
      status,
      tagName,
      tagName,
      uploaderId,
      uploaderId,
      fileExt,
      fileExt,
      minSize,
      minSize,
      maxSize,
      maxSize,
      start,
      start,
      end,
      end,
      offset,
      pageSize
    ]
  );
  const [[countRow]] = await pool.query(
    `SELECT COUNT(DISTINCT a.id) AS total
     FROM asset a
     LEFT JOIN asset_project ap ON a.id = ap.asset_id
     WHERE (a.project_id = ? OR ap.project_id = ?)
       AND (? IS NULL OR a.display_name LIKE ? OR a.standard_filename LIKE ?)
       AND (? IS NULL OR a.category_path LIKE ?)
       AND (? IS NULL OR a.status = ?)
       AND (? IS NULL OR EXISTS (SELECT 1 FROM asset_tag at2 JOIN tag t2 ON at2.tag_id = t2.id WHERE at2.asset_id = a.id AND t2.name = ?))
       AND (? IS NULL OR a.uploader_id = ?)
       AND (? IS NULL OR a.file_ext = ?)
       AND (? IS NULL OR a.file_size >= ?)
       AND (? IS NULL OR a.file_size <= ?)
       AND (? IS NULL OR a.created_at >= ?)
       AND (? IS NULL OR a.created_at <= ?)`,
    [
      access.projectId,
      access.projectId,
      keyword,
      keyword,
      keyword,
      categoryLike,
      categoryLike,
      status,
      status,
      tagName,
      tagName,
      uploaderId,
      uploaderId,
      fileExt,
      fileExt,
      minSize,
      minSize,
      maxSize,
      maxSize,
      start,
      start,
      end,
      end
    ]
  );
  ctx.body = { code: 200, message: "OK", data: { total: Number(countRow.total || 0), items: rows }, timestamp: Date.now() };
});

router.get("/health", async (ctx) => {
  ctx.body = { code: 200, message: "OK", data: { uptime: process.uptime() }, timestamp: Date.now() };
});

app.use(router.routes()).use(router.allowedMethods());

app.listen(PORT, () => {
  console.log(`ResHub backend listening on http://localhost:${PORT}`);
});
