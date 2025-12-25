import { pool } from "../src/db.js";

async function main() {
  await pool.query(
    "CREATE TABLE IF NOT EXISTS `category` ( `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, `project_id` INT UNSIGNED NOT NULL, `name` VARCHAR(100) NOT NULL, `path` VARCHAR(255) NOT NULL, `type` ENUM('ui','character','model','animation','vfx','bgm','sfx','raw') DEFAULT 'raw' NOT NULL, `parent_id` INT UNSIGNED NULL, `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY `uk_project_path` (`project_id`,`path`), INDEX `idx_project_type` (`project_id`,`type`) ) ENGINE=InnoDB"
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
