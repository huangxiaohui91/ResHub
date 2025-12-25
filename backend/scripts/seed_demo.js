import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import axios from "axios";
import crypto from "crypto";
import bcrypt from "bcryptjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "asset_dev",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "game_asset_center",
};

const STORAGE_ROOT = path.resolve(process.env.STORAGE_LOCAL_ROOT || path.resolve(__dirname, "..", "..", "uploads"));

// Helpers
const calcHash = async (buffer) => {
    const hash = crypto.createHash("sha256");
    hash.update(buffer);
    return hash.digest("hex");
};

const slugify = (s) => String(s).replace(/\.[^/.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
const extractCategoryKey = (p) => String(p).split("/").slice(-2).join("_").toLowerCase();
const formatTs = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
};

async function downloadFile(url) {
    console.log(`Downloading ${url}...`);
    try {
        const res = await axios.get(url, { responseType: "arraybuffer", timeout: 15000 });
        return Buffer.from(res.data);
    } catch (e) {
        console.error(`Download error for ${url}: ${e.message}`);
        throw e;
    }
}

// Fallback generator for audio if download fails
function createWavBuffer() {
  const sampleRate = 44100;
  const numChannels = 1;
  const bitsPerSample = 16;
  const durationSeconds = 2;
  const dataSize = sampleRate * numChannels * (bitsPerSample / 8) * durationSeconds;
  const fileSize = 36 + dataSize;

  const buffer = Buffer.alloc(44 + dataSize);
  
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(fileSize, 4); 
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); 
  buffer.writeUInt16LE(1, 20); 
  buffer.writeUInt16LE(numChannels, 22); 
  buffer.writeUInt32LE(sampleRate, 24); 
  buffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28); 
  buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 32); 
  buffer.writeUInt16LE(bitsPerSample, 34); 
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40); 
  
  for (let i = 0; i < dataSize; i += 2) {
      const t = (i / 2) / sampleRate;
      const amplitude = 10000;
      const val = Math.sin(2 * Math.PI * 440 * t) * amplitude;
      buffer.writeInt16LE(Math.floor(val), 44 + i);
  }
  return buffer;
}

const PROJECT_CODE = "library";
const PROJECT_NAME = "Resource Library";

// Reliable public assets
const ASSETS = [
    {
        name: "Landscape Mountain",
        category: "art/scene",
        type: "jpg",
        url: "https://picsum.photos/seed/mountain/800/600",
        desc: "Beautiful mountain landscape.",
        tags: ["nature", "mountain", "background"]
    },
    {
        name: "City Street",
        category: "art/scene",
        type: "jpg",
        url: "https://picsum.photos/seed/city/800/600",
        desc: "Urban city street view.",
        tags: ["city", "urban", "background"]
    },
    {
        name: "UI Button Set",
        category: "art/ui",
        type: "png",
        url: "https://picsum.photos/seed/ui_btn/200/100",
        desc: "Standard UI buttons.",
        tags: ["ui", "interface", "button"]
    },
    {
        name: "Character Avatar",
        category: "art/character",
        type: "png",
        url: "https://picsum.photos/seed/avatar/200/200",
        desc: "Player avatar icon.",
        tags: ["character", "icon"]
    },
    {
        name: "Duck Model",
        category: "art/model",
        type: "glb",
        url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/glTF-Binary/Duck.glb",
        desc: "A yellow rubber duck (glTF sample).",
        tags: ["animal", "prop", "3d"]
    },
    {
        name: "Box Model",
        category: "art/model",
        type: "glb",
        url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Box/glTF-Binary/Box.glb",
        desc: "A simple textured box.",
        tags: ["prop", "basic", "3d"]
    },
    {
        name: "Glass Sound",
        category: "audio/sfx",
        type: "wav",
        url: "https://github.com/mathiasbynens/small/raw/master/wave.wav", 
        // Fallback or specific small file. Using a reliable small wav test file.
        // Actually that URL is a tiny wav.
        desc: "Glass ping sound.",
        tags: ["sfx", "glass"]
    },
    {
        name: "Ambient Beep",
        category: "audio/bgm", // Categorized as bgm for demo
        type: "mp3",
        url: "https://github.com/mathiasbynens/small/raw/master/mp3.mp3",
        desc: "Short ambient tone.",
        tags: ["ambient", "short"]
    }
];

async function run() {
    const conn = await mysql.createConnection(dbConfig);
    console.log("Connected to DB.");

    // 1. Create/Ensure 'library' Project
    const [rows] = await conn.query("SELECT * FROM project WHERE code = ?", [PROJECT_CODE]);
    let projectId;
    if (rows.length === 0) {
        const [res] = await conn.query(
            "INSERT INTO project (name, code, description, created_by, created_at) VALUES (?, ?, ?, ?, NOW())", 
            [PROJECT_NAME, PROJECT_CODE, "Central Resource Library", 1]
        );
        projectId = res.insertId;
        console.log(`Created project '${PROJECT_NAME}' (${PROJECT_CODE})`);
    } else {
        projectId = rows[0].id;
        console.log(`Using existing project '${PROJECT_NAME}' (${PROJECT_CODE})`);
    }

    // 2. Ensure Admin User
    const [users] = await conn.query("SELECT id FROM user LIMIT 1");
    if (users.length === 0) {
        console.log("Creating default admin...");
        const hash = await bcrypt.hash("password", 10);
        const [res] = await conn.query("INSERT INTO user (username, password_hash, real_name, system_role, created_at) VALUES (?, ?, ?, ?, NOW())", ["admin", hash, "Admin", "super_admin"]);
        users.push({ id: res.insertId });
    }
    const userId = users[0].id;

    // 3. Ensure User is in Project
    await conn.query("INSERT IGNORE INTO project_member (user_id, project_id, project_role, joined_at) VALUES (?, ?, 'owner', NOW())", [userId, projectId]);

    // 4. Process Assets
    for (const item of ASSETS) {
        console.log(`Processing ${item.name}...`);
        
        // Check duplication
        const namePart = slugify(item.name);
        const [exist] = await conn.query("SELECT id FROM asset WHERE project_id = ? AND display_name = ? LIMIT 1", [projectId, item.name]);
        if (exist.length > 0) {
            console.log(`  -> Already exists, skipping.`);
            continue;
        }

        let buffer;
        try {
            buffer = await downloadFile(item.url);
        } catch (e) {
            console.log("  -> Download failed, using fallback/dummy.");
            if (['wav', 'mp3', 'ogg'].includes(item.type)) {
                buffer = createWavBuffer();
            } else {
                buffer = Buffer.from(`Dummy content for ${item.name} - download failed.`);
            }
        }

        const ext = item.type;
        const hash = await calcHash(buffer);
        
        // Naming
        const typeMap = { png: "tex", jpg: "tex", jpeg: "tex", wav: "sfx", mp3: "bgm", ogg: "sfx", glb: "mod" };
        const typePrefix = typeMap[ext] || "raw";
        const catKey = extractCategoryKey(item.category);
        const ts = formatTs();
        
        const standardFilename = `${PROJECT_CODE}_${typePrefix}_${catKey}_${namePart}_${ts}.${ext}`;
        
        // Save File
        const now = new Date();
        const yyyy = String(now.getFullYear());
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const dd = String(now.getDate()).padStart(2, "0");
        const catParts = item.category.split("/");
        
        const relDir = path.join(PROJECT_CODE, ...catParts, yyyy, mm, dd);
        const absDir = path.resolve(STORAGE_ROOT, relDir);
        await fs.mkdir(absDir, { recursive: true });
        
        const relPath = path.join(relDir, standardFilename).replace(/\\/g, "/");
        const absPath = path.join(absDir, standardFilename);
        
        await fs.writeFile(absPath, buffer);
        
        // DB Insert Asset
        const assetUid = `AST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        
        const [res] = await conn.query(
            "INSERT INTO asset (asset_uid, original_filename, standard_filename, file_hash, file_size, file_ext, storage_path, display_name, category_path, project_id, uploader_id, current_version, status, meta_info, download_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW(), NOW())",
            [
                assetUid,
                `${item.name}.${ext}`,
                standardFilename,
                hash,
                buffer.length,
                ext,
                relPath,
                item.name,
                item.category,
                projectId,
                userId,
                1,
                "approved",
                JSON.stringify({ description: item.desc })
            ]
        );
        const assetId = res.insertId;
        
        // DB Insert Version
        await conn.query(
            "INSERT INTO asset_version (asset_id, version_number, file_hash, storage_path, uploader_id, change_log, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())",
            [assetId, 1, hash, relPath, userId, "Initial seed"]
        );
        
        // DB Insert Project Link
        await conn.query("INSERT IGNORE INTO asset_project (asset_id, project_id) VALUES (?, ?)", [assetId, projectId]);
        
        // DB Insert Tags
        if (item.tags && item.tags.length > 0) {
            for (const tagName of item.tags) {
                // Find or create tag
                const [tagRows] = await conn.query("SELECT id FROM tag WHERE name = ? AND project_id = ?", [tagName, projectId]);
                let tagId;
                if (tagRows.length > 0) {
                    tagId = tagRows[0].id;
                } else {
                    const [tRes] = await conn.query("INSERT INTO tag (name, project_id, color, created_by, created_at) VALUES (?, ?, ?, ?, NOW())", [tagName, projectId, "#409EFF", userId]);
                    tagId = tRes.insertId;
                }
                await conn.query("INSERT IGNORE INTO asset_tag (asset_id, tag_id, created_at) VALUES (?, ?, NOW())", [assetId, tagId]);
            }
        }

        console.log(`  -> Created asset ${assetId}: ${standardFilename}`);
        await new Promise(r => setTimeout(r, 100));
    }

    await conn.end();
    console.log("Seeding complete.");
    process.exit(0);
}

run();
