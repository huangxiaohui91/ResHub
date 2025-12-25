游戏资源管理平台 - AI可执行开发规格文档
1. 项目概述

1.1 项目目标 构建一个B/S架构的中央化游戏资源（美术、音频）管理平台，实现资源的规范化存储、版本控制、跨项目检索与权限管理，服务于15人以下的游戏开发团队。

1.2 核心功能

    RBAC（基于角色的访问控制）与多项目隔离。
    支持强制命名规范的资源上传、版本管理与秒传。
    基于分类、标签、关键词的灵活资源检索。
    完整的审核状态流（制作中 -> 待审核 -> 已定稿/驳回）。
    资源预览（图片缩略图、音频基础信息）。

1.3 技术栈

    后端: Node.js (最新LTS版本，建议20+)， Koa2框架

    数据库: MySQL 8.0+

    前端: Vue 3 + Composition API， Element Plus UI， Vite构建工具

    存储: 服务器本地文件系统（初步），预留对象存储扩展接口

    关键依赖:
        koa-router: 路由
        koa-body: 解析请求体（支持multipart/form-data）
        jsonwebtoken: JWT认证
        mysql2: MySQL驱动
        dotenv: 环境变量管理
        multer或自定义中间件： 文件流处理
        crypto: 计算文件哈希（Node.js内置）

2. 数据库详细设计（完整DDL）

执行以下SQL脚本初始化数据库：

-- 1. 创建数据库与用户
CREATE DATABASE IF NOT EXISTS `game_asset_center` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `game_asset_center`;
CREATE USER ‘asset_dev‘@‘%‘ IDENTIFIED BY ‘StrongPassword123!‘;
GRANT ALL PRIVILEGES ON `game_asset_center`.* TO ‘asset_dev‘@‘%‘;
FLUSH PRIVILEGES;

-- 2. 用户表
DROP TABLE IF EXISTS `user`;
CREATE TABLE `user` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(50) NOT NULL UNIQUE COMMENT ‘登录账号‘,
  `password_hash` VARCHAR(255) NOT NULL COMMENT ‘BCrypt加密密码‘,
  `email` VARCHAR(100),
  `real_name` VARCHAR(50),
  `system_role` ENUM(‘super_admin‘, ‘admin‘, ‘user‘) DEFAULT ‘user‘ NOT NULL COMMENT ‘系统全局角色‘,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_username` (`username`)
) ENGINE=InnoDB COMMENT=‘系统用户表‘;

-- 3. 项目表
DROP TABLE IF EXISTS `project`;
CREATE TABLE `project` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `code` VARCHAR(20) NOT NULL UNIQUE COMMENT ‘项目唯一标识，如ax‘,
  `name` VARCHAR(100) NOT NULL,
  `description` TEXT,
  `created_by` INT UNSIGNED NOT NULL COMMENT ‘创建者用户ID‘,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB COMMENT=‘项目表‘;

-- 4. 项目成员表（实现项目级权限）
DROP TABLE IF EXISTS `project_member`;
CREATE TABLE `project_member` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `project_id` INT UNSIGNED NOT NULL,
  `user_id` INT UNSIGNED NOT NULL,
  `project_role` ENUM(‘manager‘, ‘developer‘, ‘viewer‘) DEFAULT ‘developer‘ NOT NULL,
  `joined_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_project_user` (`project_id`, `user_id`),
  FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT=‘项目成员与权限表‘;

-- 5. 资源主表（核心）
DROP TABLE IF EXISTS `asset`;
CREATE TABLE `asset` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `asset_uid` VARCHAR(64) NOT NULL UNIQUE COMMENT ‘业务唯一ID，格式：AST-{timestamp}-{seq}‘,
  `original_filename` VARCHAR(512) NOT NULL,
  `standard_filename` VARCHAR(512) NOT NULL COMMENT ‘规范化的文件名‘,
  `file_hash` CHAR(64) NOT NULL COMMENT ‘SHA-256哈希值，用于去重‘,
  `file_size` BIGINT UNSIGNED NOT NULL COMMENT ‘字节数‘,
  `file_ext` VARCHAR(20) NOT NULL,
  `storage_path` VARCHAR(1024) NOT NULL COMMENT ‘服务器本地相对存储路径‘,
  `display_name` VARCHAR(255) NOT NULL COMMENT ‘展示用名称‘,
  `category_path` VARCHAR(255) NOT NULL COMMENT ‘分类路径，如：美术/UI/按钮‘,
  `project_id` INT UNSIGNED NOT NULL,
  `uploader_id` INT UNSIGNED NOT NULL,
  `current_version` INT UNSIGNED DEFAULT 1,
  `status` ENUM(‘draft‘, ‘under_review‘, ‘approved‘, ‘rejected‘, ‘archived‘) DEFAULT ‘draft‘,
  `meta_info` JSON DEFAULT NULL COMMENT ‘扩展元数据，如：{“width”: 256, “height”: 256, “duration”: 3.5}‘,
  `download_count` INT UNSIGNED DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_project_category` (`project_id`, `category_path`),
  INDEX `idx_file_hash` (`file_hash`),
  INDEX `idx_status` (`status`),
  INDEX `idx_uploader` (`uploader_id`),
  FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`uploader_id`) REFERENCES `user`(`id`)
) ENGINE=InnoDB COMMENT=‘资源主表‘;

-- 6. 资源版本表
DROP TABLE IF EXISTS `asset_version`;
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
) ENGINE=InnoDB COMMENT=‘资源版本历史表‘;

-- 7. 标签表（支持全局和项目私有）
DROP TABLE IF EXISTS `tag`;
CREATE TABLE `tag` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(50) NOT NULL,
  `project_id` INT UNSIGNED NULL COMMENT ‘NULL表示全局标签‘,
  `color` VARCHAR(7) DEFAULT ‘#409EFF‘,
  `created_by` INT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_name_project` (`name`, `project_id`),
  INDEX `idx_project` (`project_id`),
  FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`created_by`) REFERENCES `user`(`id`)
) ENGINE=InnoDB COMMENT=‘标签表‘;

-- 8. 资源-标签关联表
DROP TABLE IF EXISTS `asset_tag`;
CREATE TABLE `asset_tag` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `asset_id` BIGINT UNSIGNED NOT NULL,
  `tag_id` INT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_asset_tag` (`asset_id`, `tag_id`),
  FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`tag_id`) REFERENCES `tag`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT=‘资源标签关联表‘;

-- 9. 审核记录表
DROP TABLE IF EXISTS `review_record`;
CREATE TABLE `review_record` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `asset_id` BIGINT UNSIGNED NOT NULL,
  `applicant_id` INT UNSIGNED NOT NULL COMMENT ‘申请人‘,
  `reviewer_id` INT UNSIGNED NULL COMMENT ‘审核人‘,
  `from_status` VARCHAR(50) NOT NULL,
  `to_status` VARCHAR(50) NOT NULL,
  `comment` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_asset` (`asset_id`),
  FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`applicant_id`) REFERENCES `user`(`id`),
  FOREIGN KEY (`reviewer_id`) REFERENCES `user`(`id`)
) ENGINE=InnoDB COMMENT=‘审核流水记录表‘;

-- 初始化一个超级管理员用户（密码：admin123）
INSERT INTO `user` (`username`, `password_hash`, `real_name`, `system_role`) VALUES
(‘admin‘, ‘$2b$10$YourBcryptHashHere‘, ‘系统管理员‘, ‘super_admin‘);

3. 后端API规范（OpenAPI风格）

3.1 公共响应格式

{
  "code": 200, // 业务状态码：200成功，400客户端错误，401未认证，403无权限，500服务器错误
  "message": "操作成功",
  "data": {},  // 响应数据
  "timestamp": 1649750400000
}

3.2 认证与权限

    认证方式：Bearer Token (JWT)，通过Authorization请求头传递。

    权限中间件需按顺序执行：
        验证JWT有效性，解析userId。
        检查用户是否被禁用。
        项目级权限：对于涉及projectId的接口，查询project_member表验证用户角色。

3.3 核心接口定义
模块 	方法 	路径 	描述 	请求体/参数 	成功响应 (data字段)
认证 	POST 	/api/v1/auth/login 	用户登录 	{username, password} 	{token, userInfo}
项目管理 	GET 	/api/v1/projects 	获取用户有权访问的项目列表 	- 	[{id, code, name, role}]
资源上传 	POST 	/api/v1/assets 	核心：上传资源 	multipart/form-data (file + meta) 	{asset} (完整资源对象)
资源检索 	GET 	/api/v1/assets 	分页搜索资源 	查询参数见下文 	{total, items: [], ...}
资源管理 	GET 	/api/v1/assets/:assetUid 	获取资源详情 	- 	{asset, versions, tags}
	PUT 	/api/v1/assets/:assetUid 	更新元数据 	{displayName, categoryPath, tags} 	{asset}
	POST 	/api/v1/assets/:assetUid/versions 	上传新版本文件 	multipart/form-data (file + changeLog) 	{version}
标签管理 	GET 	/api/v1/tags 	获取标签列表 	?projectId=&keyword= 	[{id, name, color, ...}]
	POST 	/api/v1/tags 	创建标签 	{name, color, projectId?} 	{tag}
审核流 	POST 	/api/v1/assets/:assetUid/review/submit 	提交审核 	{comment} 	{reviewRecord}
	POST 	/api/v1/assets/:assetUid/review/approve 	审核通过 	{comment} 	{reviewRecord}
	POST 	/api/v1/assets/:assetUid/review/reject 	审核驳回 	{comment} 	{reviewRecord}

3.4 关键接口详情

接口：POST /api/v1/assets (资源上传)

    Content-Type: multipart/form-data

    表单字段:

        file: 资源文件 (必填)

        meta: JSON字符串 (必填)，结构：

        {
          "projectCode": "ax",
          "categoryPath": "美术/UI/按钮",
          "displayName": "开始按钮",
          "tags": ["卡通", "主界面", "按钮"]
        }

    后端处理算法:

        验证与解析:
            验证用户令牌。
            解析meta，根据projectCode验证用户在该项目是否有developer以上权限。

        文件处理:
            计算文件流的SHA-256哈希值 (fileHash)。
            检查asset表中是否存在相同project_id和fileHash且状态为approved的记录。若存在，触发“秒传”，直接关联现有文件，跳至步骤6。
            根据规范生成standard_filename。规则: [projectCode]_[type]_[category]_[name]_[timestamp].[ext]。例如: ax_tex_ui_button_start_2024120501.png。
            确定存储路径: uploads/{projectCode}/{yyyy}/{MM}/{dd}/{standard_filename}。
            将文件流写入服务器本地该路径。

        数据库操作:
            生成asset_uid: AST-${Date.now()}-${randomSeq(4)}。
            在asset表插入新记录。
            在asset_version表插入版本1记录。
            处理tags数组：遍历，查询tag表（匹配name和projectId），若不存在则创建新标签，然后在asset_tag表建立关联。

        响应: 返回完整的asset对象，包含assetUid、预览URL等。

接口：GET /api/v1/assets (资源搜索)

    查询参数:
    参数名 	类型 	必需 	描述
    projectCode 	string 	是 	项目代码
    keyword 	string 	否 	在display_name和standard_filename中模糊匹配
    categoryPath 	string 	否 	分类路径前缀匹配，如美术/UI
    tagNames 	string 	否 	逗号分隔的标签名，如卡通,主界面（需同时满足）
    status 	string 	否 	资源状态
    uploaderId 	number 	否 	上传者ID
    page 	number 	否 	页码，默认1
    pageSize 	number 	否 	页大小，默认20，最大100

    SQL构建逻辑:

    SELECT a.*, u.real_name as uploader_name,
           GROUP_CONCAT(DISTINCT t.name) as tag_names
    FROM asset a
    LEFT JOIN user u ON a.uploader_id = u.id
    LEFT JOIN asset_tag at ON a.id = at.asset_id
    LEFT JOIN tag t ON at.tag_id = t.id
    WHERE a.project_id = :projectId
      AND (:keyword IS NULL OR a.display_name LIKE :keywordLike OR a.standard_filename LIKE :keywordLike)
      AND (:categoryPath IS NULL OR a.category_path LIKE :categoryPathLike)
      AND (:status IS NULL OR a.status = :status)
      AND (:uploaderId IS NULL OR a.uploader_id = :uploaderId)
    GROUP BY a.id
    HAVING (:tagCondition IS NULL OR FIND_IN_SET(:tagName, tag_names) > 0) -- 简化处理，实际生产环境建议用JOIN解决
    ORDER BY a.id DESC
    LIMIT :offset, :limit

4. 前端Vue 3组件与路由规范

4.1 项目结构

frontend/
├── public/
├── src/
│   ├── api/              # API请求封装
│   │   ├── client.ts     # 基于axios的HTTP客户端
│   │   ├── auth.ts       # 认证相关API
│   │   ├── asset.ts      # 资源相关API
│   │   └── project.ts    # 项目相关API
│   ├── components/       # 通用组件
│   │   ├── layout/       # 布局组件
│   │   ├── asset/        # 资源相关展示组件
│   │   └── common/       # 通用UI组件
│   ├── composables/      # Composition API 复用逻辑
│   │   ├── useAuth.ts    # 认证状态管理
│   │   └── useAssetSearch.ts # 资源搜索逻辑
│   ├── router/           # 路由配置
│   ├── stores/           # Pinia状态存储
│   │   ├── auth.store.ts
│   │   └── project.store.ts
│   ├── views/            # 页面组件
│   │   ├── Login.vue
│   │   ├── Dashboard.vue
│   │   ├── AssetList.vue      # 资源列表页
│   │   ├── AssetUpload.vue    # 资源上传页
│   │   └── AssetDetail.vue    # 资源详情页
│   └── App.vue

4.2 关键组件实现要点

组件：AssetUpload.vue

    功能：拖拽/点击上传，表单填写，实时预览。

    核心逻辑:
        使用<input type="file">或第三方拖拽库。
        文件选择后，自动提取projectCode（从路由或store），调用后端接口获取项目下的分类树和常用标签。
        实现标签输入组件：输入时下拉联想（调用/api/v1/tags接口），回车创建新标签。
        上传前，前端可对文件名进行规范预校验，给出友好提示。
        使用FormData对象组装file和meta，调用asset.ts中的上传API。
        显示上传进度（利用axios的onUploadProgress回调）。

组件：AssetList.vue

    功能：综合搜索、资源网格列表展示、批量操作。

    核心逻辑:
        左侧固定为项目选择器和分类树导航。
        顶部为综合搜索栏，包含关键词输入框、状态筛选下拉框、标签选择器（支持多选）。
        使用useAssetSearch composable 管理搜索参数，监听参数变化自动发起请求。
        资源卡片显示：缩略图（图片直接显示缩略，音频显示波形图标）、名称、状态标签、操作按钮（编辑、下载、提交审核）。
        集成Element Plus的Pagination组件。

4.3 状态管理（Pinia）示例

// stores/auth.store.ts
import { defineStore } from 'pinia';
export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('token') || '',
    userInfo: null as UserInfo | null,
  }),
  actions: {
    async login(credentials: LoginReq) {
      const resp = await authApi.login(credentials);
      this.token = resp.token;
      this.userInfo = resp.userInfo;
      localStorage.setItem('token', resp.token);
      // 配置axios全局请求头
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${resp.token}`;
    },
    logout() { /* 清理逻辑 */ }
  }
});

5. 部署与配置

5.1 环境变量配置（.env文件）

# 后端 .env
NODE_ENV=production
PORT=3000
JWT_SECRET=your-super-secret-jwt-key-change-this
DB_HOST=localhost
DB_PORT=3306
DB_USER=asset_dev
DB_PASSWORD=StrongPassword123!
DB_NAME=game_asset_center
STORAGE_TYPE=local
STORAGE_LOCAL_ROOT=/var/www/resources
API_BASE_URL=http://localhost:3000/api/v1

# 前端 .env.production
VITE_API_BASE_URL=http://your-domain.com/api/v1

5.2 服务器本地存储目录结构

/var/www/resources/          # STORAGE_LOCAL_ROOT
├── uploads/                 # 动态上传的文件
│   ├── ax/                  # 项目代码
│   │   ├── 2024/
│   │   │   ├── 12/
│   │   │   │   ├── 05/     # 按日期组织
│   │   │   │   │   └── ax_tex_ui_button_start_2024120501.png
│   │   │   │   └── ...
│   │   │   └── ...
│   │   └── ...
│   └── ...
├── thumbnails/              # 缩略图缓存（可后期生成）
└── backups/                 # 备份目录

5.3 启动脚本

    后端 (backend/package.json):

    "scripts": {
      "dev": "nodemon src/app.js",
      "start": "node src/app.js",
      "migrate": "node scripts/run-migrations.js"
    }

    前端 (frontend/package.json):

    "scripts": {
      "dev": "vite",
      "build": "vue-tsc && vite build",
      "preview": "vite preview"
    }

6. 核心业务逻辑补充说明

6.1 资源命名规范化算法（伪代码）

function generateStandardFilename(originalName, projectCode, categoryPath, userInputName) {
    // 1. 提取扩展名
    ext = getFileExtension(originalName).toLowerCase();

    // 2. 根据文件扩展名和分类路径推断资源类型
    typeMap = {‘png‘:‘tex‘, ‘jpg‘:‘tex‘, ‘wav‘:‘sfx‘, ‘mp3‘:‘bgm‘};
    type = typeMap[ext] || ‘raw‘;

    // 3. 从分类路径中提取关键部分，如‘美术/UI/按钮‘ -> ‘ui_button‘
    categoryKey = extractCategoryKey(categoryPath);

    // 4. 使用用户输入的displayName或从原始文件名提取，转换为小写+下划线
    namePart = slugify(userInputName || removeExtension(originalName));

    // 5. 生成时间戳部分
    timestampPart = formatDate(new Date(), ‘YYYYMMDDHHmmss‘);

    // 6. 组装
    return `${projectCode}_${type}_${categoryKey}_${namePart}_${timestampPart}.${ext}`;
}

6.2 文件哈希与秒传逻辑

const crypto = require(‘crypto‘);
const fs = require(‘fs‘);

async function calculateFileHash(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash(‘sha256‘);
        const stream = fs.createReadStream(filePath);
        stream.on(‘data‘, chunk => hash.update(chunk));
        stream.on(‘end‘, () => resolve(hash.digest(‘hex‘)));
        stream.on(‘error‘, reject);
    });
}

// 在上传控制器中
const fileHash = await calculateFileHash(tempFilePath);
const existingAsset = await AssetModel.findApprovedByHash(projectId, fileHash);
if (existingAsset) {
    // 秒传逻辑：不存储文件，直接关联existingAsset
    return await createAssetReference(existingAsset, newMetadata, userId);
}

6.3 权限检查中间件（示例）

async function checkProjectPermission(ctx, next) {
    const { projectCode } = ctx.params;
    const userId = ctx.state.user.id;

    const project = await ProjectModel.findByCode(projectCode);
    if (!project) {
        ctx.throw(404, ‘项目不存在‘);
    }

    const member = await ProjectMemberModel.find(userId, project.id);
    if (!member) {
        ctx.throw(403, ‘您无权访问此项目‘);
    }

    // 将项目信息和角色挂载到上下文，供后续使用
    ctx.state.project = project;
    ctx.state.projectRole = member.project_role;

    await next();
}