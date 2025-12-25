import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env from backend root
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "asset_dev",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "game_asset_center",
};

async function run() {
  console.log("Connecting to DB...", dbConfig.host, dbConfig.database);
  let conn;
  try {
      conn = await mysql.createConnection(dbConfig);
  } catch(e) {
      console.error("Connection failed:", e.message);
      process.exit(1);
  }

  const tables = [
    "asset", "asset_tag", "asset_version", "asset_project", "review_record"
  ];

  console.log("Truncating tables...");
  await conn.query("SET FOREIGN_KEY_CHECKS = 0");
  for (const t of tables) {
    try {
        await conn.query(`TRUNCATE TABLE ${t}`);
        console.log(`Truncated ${t}`);
    } catch(e) {
        console.log(`Error truncating ${t}: ${e.message}`);
    }
  }
  await conn.query("SET FOREIGN_KEY_CHECKS = 1");

  console.log("Deleting files...");
  // scripts/ is in backend/scripts
  // we want ResHub/uploads
  // backend/scripts -> .. -> backend -> .. -> ResHub -> uploads
  const storageRoot = path.resolve(__dirname, "..", "..", "uploads");
  console.log("Storage Root:", storageRoot);

  try {
    // Check if exists
    try {
        await fs.access(storageRoot);
        // If exists, empty it.
        // rm recursive
        await fs.rm(storageRoot, { recursive: true, force: true });
    } catch {}
    
    // Recreate
    await fs.mkdir(storageRoot, { recursive: true });
    console.log("Cleared and recreated uploads directory.");
  } catch (e) {
    console.error("Error clearing files:", e);
  }

  await conn.end();
  console.log("Done.");
  process.exit(0);
}

run();
