import dotenv from "dotenv";
import path from "path";
import fs from "fs/promises";
import { createReadStream } from "fs";
import crypto from "crypto";
import { pool } from "../src/db.js";

dotenv.config();

const STORAGE_ROOT = process.env.STORAGE_LOCAL_ROOT || path.resolve(process.cwd(), "storage");
const projectCode = "ax";
const uploaderUsername = "admin";

const samples = [
  {
    file: path.resolve(process.cwd(), "..", "test-assets", "sample1.txt"),
    displayName: "示例图标一",
    categoryPath: "tex/ui/icons",
    tags: ["ui", "icon"]
  },
  {
    file: path.resolve(process.cwd(), "..", "test-assets", "sample2.txt"),
    displayName: "示例音效一",
    categoryPath: "sfx/ui",
    tags: ["sfx", "ui"]
  }
];

function calcHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const s = createReadStream(filePath);
    s.on("data", (c) => hash.update(c));
    s.on("end", () => resolve(hash.digest("hex")));
    s.on("error", reject);
  });
}

function slugify(s) {
  return String(s || "")
    .replace(/\.[^/.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function extractCategoryKey(categoryPath) {
  return String(categoryPath || "").split("/").slice(-2).join("_").toLowerCase();
}

function formatTs() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function main() {
  const [[proj]] = await pool.query("SELECT id FROM project WHERE code = ?", [projectCode]);
  if (!proj) throw new Error(`project ${projectCode} not found`);
  const [[u]] = await pool.query("SELECT id FROM user WHERE username = ?", [uploaderUsername]);
  if (!u) throw new Error(`uploader ${uploaderUsername} not found`);
  const uploaderId = u.id;

  const typeMap = { png: "tex", jpg: "tex", jpeg: "tex", wav: "sfx", mp3: "bgm", txt: "raw" };
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");

  for (const s of samples) {
    const ext = String(s.file.split(".").pop() || "").toLowerCase();
    const type = typeMap[ext] || "raw";
    const categoryKey = extractCategoryKey(s.categoryPath);
    const namePart = slugify(path.basename(s.file));
    const ts = formatTs();
    const standardFilename = `${projectCode}_${type}_${categoryKey}_${namePart}_${ts}.${ext}`;
    const relDir = path.join("uploads", projectCode, yyyy, mm, dd);
    const absDir = path.resolve(STORAGE_ROOT, relDir);
    await fs.mkdir(absDir, { recursive: true });
    const relPath = path.join(relDir, standardFilename).replace(/\\/g, "/");
    const absPath = path.resolve(STORAGE_ROOT, relPath);
    const fileHash = await calcHash(s.file);
    await fs.copyFile(s.file, absPath);
    const assetUid = `AST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const [assetRes] = await pool.query(
      "INSERT INTO asset (asset_uid, original_filename, standard_filename, file_hash, file_size, file_ext, storage_path, display_name, category_path, project_id, uploader_id, current_version, status, meta_info, download_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW(), NOW())",
      [
        assetUid,
        path.basename(s.file),
        standardFilename,
        fileHash,
        0,
        ext,
        relPath,
        s.displayName,
        s.categoryPath,
        proj.id,
        uploaderId,
        1,
        "approved",
        null
      ]
    );
    const assetId = assetRes.insertId;
    await pool.query(
      "INSERT INTO asset_version (asset_id, version_number, file_hash, storage_path, uploader_id, change_log, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())",
      [assetId, 1, fileHash, relPath, uploaderId, "seed"]
    );
    for (const tagName of s.tags) {
      const [[tag]] = await pool.query("SELECT id FROM tag WHERE name = ? AND project_id = ?", [String(tagName), proj.id]);
      let tagId = tag ? tag.id : null;
      if (!tagId) {
        const [tagRes] = await pool.query(
          "INSERT INTO tag (name, project_id, color, created_by, created_at) VALUES (?, ?, ?, ?, NOW())",
          [String(tagName), proj.id, "#409EFF", uploaderId]
        );
        tagId = tagRes.insertId;
      }
      await pool.query("INSERT IGNORE INTO asset_tag (asset_id, tag_id, created_at) VALUES (?, ?, NOW())", [assetId, tagId]);
    }
    console.log(`seeded asset ${standardFilename}`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
