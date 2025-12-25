-- 1. 创建数据库
CREATE DATABASE IF NOT EXISTS `game_asset_center` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `game_asset_center`;

-- 2. 清理旧表 (按依赖顺序)
DROP TABLE IF EXISTS `asset_tag`;
DROP TABLE IF EXISTS `review_record`;
DROP TABLE IF EXISTS `asset_version`;
DROP TABLE IF EXISTS `asset_project`;
DROP TABLE IF EXISTS `asset`;
DROP TABLE IF EXISTS `tag`;
DROP TABLE IF EXISTS `category`;
DROP TABLE IF EXISTS `project_member`;
DROP TABLE IF EXISTS `project`;
DROP TABLE IF EXISTS `user`;

-- 3. 创建表结构

-- 用户表
CREATE TABLE `user` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `email` VARCHAR(100),
  `real_name` VARCHAR(50),
  `system_role` ENUM('super_admin','admin','user') DEFAULT 'user' NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_username` (`username`)
) ENGINE=InnoDB;

-- 项目表
CREATE TABLE `project` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `code` VARCHAR(20) NOT NULL UNIQUE,
  `name` VARCHAR(100) NOT NULL,
  `description` TEXT,
  `created_by` INT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 项目成员表
CREATE TABLE `project_member` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `project_id` INT UNSIGNED NOT NULL,
  `user_id` INT UNSIGNED NOT NULL,
  `project_role` ENUM('manager','developer','viewer') DEFAULT 'developer' NOT NULL,
  `joined_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_project_user` (`project_id`, `user_id`),
  FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 资源分类表
CREATE TABLE `category` ( 
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, 
  `project_id` INT UNSIGNED NOT NULL, 
  `name` VARCHAR(100) NOT NULL, 
  `path` VARCHAR(255) NOT NULL, 
  `type` ENUM('ui','character','model','animation','vfx','bgm','sfx','raw') DEFAULT 'raw' NOT NULL, 
  `parent_id` INT UNSIGNED NULL, 
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
  UNIQUE KEY `uk_project_path` (`project_id`,`path`), 
  INDEX `idx_project_type` (`project_id`,`type`) 
) ENGINE=InnoDB;

-- 资产主表
CREATE TABLE `asset` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `asset_uid` VARCHAR(64) NOT NULL UNIQUE,
  `original_filename` VARCHAR(512) NOT NULL,
  `standard_filename` VARCHAR(512) NOT NULL,
  `file_hash` CHAR(64) NOT NULL,
  `file_size` BIGINT UNSIGNED NOT NULL,
  `file_ext` VARCHAR(20) NOT NULL,
  `storage_path` VARCHAR(1024) NOT NULL,
  `display_name` VARCHAR(255) NOT NULL,
  `category_path` VARCHAR(255) NOT NULL,
  `project_id` INT UNSIGNED NOT NULL,
  `uploader_id` INT UNSIGNED NOT NULL,
  `current_version` INT UNSIGNED DEFAULT 1,
  `status` ENUM('draft','under_review','approved','rejected','archived') DEFAULT 'draft',
  `meta_info` JSON DEFAULT NULL,
  `download_count` INT UNSIGNED DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_project_category` (`project_id`, `category_path`),
  INDEX `idx_file_hash` (`file_hash`),
  INDEX `idx_status` (`status`),
  INDEX `idx_uploader` (`uploader_id`),
  FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`uploader_id`) REFERENCES `user`(`id`)
) ENGINE=InnoDB;

-- 资产版本表
CREATE TABLE `asset_version` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `asset_id` BIGINT UNSIGNED NOT NULL,
  `version_number` INT UNSIGNED NOT NULL,
  `file_hash` CHAR(64) NOT NULL,
  `storage_path` VARCHAR(1024) NOT NULL,
  `uploader_id` INT UNSIGNED NOT NULL,
  `change_log` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_asset_version` (`asset_id`, `version_number`),
  FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`uploader_id`) REFERENCES `user`(`id`)
) ENGINE=InnoDB;

-- 资产-项目关联表 (Owner Project)
CREATE TABLE `asset_project` (
  `asset_id` BIGINT UNSIGNED NOT NULL,
  `project_id` INT UNSIGNED NOT NULL,
  `created_at` DATETIME DEFAULT NOW(),
  PRIMARY KEY (`asset_id`, `project_id`)
) ENGINE=InnoDB;

-- 标签表
CREATE TABLE `tag` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(50) NOT NULL,
  `project_id` INT UNSIGNED NULL,
  `color` VARCHAR(7) DEFAULT '#409EFF',
  `created_by` INT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_name_project` (`name`, `project_id`),
  INDEX `idx_project` (`project_id`),
  FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`created_by`) REFERENCES `user`(`id`)
) ENGINE=InnoDB;

-- 资产-标签关联表
CREATE TABLE `asset_tag` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `asset_id` BIGINT UNSIGNED NOT NULL,
  `tag_id` INT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_asset_tag` (`asset_id`, `tag_id`),
  FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`tag_id`) REFERENCES `tag`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 审核记录表
CREATE TABLE `review_record` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `asset_id` BIGINT UNSIGNED NOT NULL,
  `applicant_id` INT UNSIGNED NOT NULL,
  `reviewer_id` INT UNSIGNED NULL,
  `from_status` VARCHAR(50) NOT NULL,
  `to_status` VARCHAR(50) NOT NULL,
  `comment` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_asset` (`asset_id`),
  FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`applicant_id`) REFERENCES `user`(`id`),
  FOREIGN KEY (`reviewer_id`) REFERENCES `user`(`id`)
) ENGINE=InnoDB;

-- 4. 初始化基础数据

-- 初始管理员 (密码: admin123)
INSERT INTO `user` (id, username, password_hash, real_name, system_role, created_at) VALUES 
(1, 'admin', '$2a$10$TiWi9WjDUiJym8QHlXivHuzUovhi.nXz2RHEVv1TttK44.A2KfUdG', '系统管理员', 'super_admin', NOW());

-- 初始项目 (Resource Library)
INSERT INTO `project` (id, code, name, description, created_by, created_at) VALUES
(1, 'library', 'Resource Library', 'Central repository for game assets', 1, NOW());

-- 初始项目成员 (Admin as Manager)
INSERT INTO `project_member` (project_id, user_id, project_role, joined_at) VALUES
(1, 1, 'manager', NOW());

-- 初始分类 (Library)
INSERT INTO `category` (project_id, name, path, type, parent_id) VALUES
(1, 'Art', 'art', 'raw', NULL),
(1, 'Audio', 'audio', 'raw', NULL),
(1, 'Character', 'art/character', 'character', 1),
(1, 'Scene', 'art/scene', 'model', 1),
(1, 'Model', 'art/model', 'model', 1),
(1, 'UI', 'art/ui', 'ui', 1),
(1, 'BGM', 'audio/bgm', 'bgm', 2),
(1, 'SFX', 'audio/sfx', 'sfx', 2);

-- 初始标签
INSERT INTO `tag` (name, project_id, color, created_by) VALUES
('nature', 1, '#67C23A', 1),
('urban', 1, '#909399', 1),
('sci-fi', 1, '#409EFF', 1),
('fantasy', 1, '#E6A23C', 1),
('character', 1, '#F56C6C', 1);

