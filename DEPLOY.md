# ResHub 部署指南

ResHub 是一个现代化的游戏资产管理系统，包含 Vue 3 前端和 Koa.js 后端。本指南将帮助你配置和部署项目。

## 目录结构

```
ResHub/
├── backend/            # 后端项目 (Koa.js)
├── frontend/           # 前端项目 (Vue 3 + Vite)
├── mysql/              # MySQL 配置文件
├── storage/            # 资产文件存储目录 (推荐)
├── docs/               # 文档
└── .mysql-data/        # 本地 MySQL 数据目录 (自动生成)
```

## 环境要求

- **Node.js**: v18+ (推荐 v20 LTS)
- **MySQL**: 8.0+ (本项目自带 MySQL 8.4 二进制文件支持，也可使用系统安装的 MySQL)
- **OS**: Windows (本指南主要针对 Windows 环境)

## 1. 数据库配置与启动

本项目支持使用本地集成的 MySQL，避免污染系统环境。

### 启动 MySQL

在项目根目录下，使用 PowerShell 运行以下命令启动 MySQL 服务：

```powershell
# 启动命令 (请确保路径与实际安装位置一致，如果使用自带的 MySQL)
& "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe" --defaults-file="d:\0Dev\Trae_Project\ResHub\mysql\my.ini" --console
```

*注意：请根据实际情况修改 `mysqld.exe` 的路径。如果是全新部署，可能需要先初始化数据目录（本项目已包含初始化好的 `.mysql-data`）。*

### 数据库连接配置

修改 `backend/.env` 文件中的数据库配置：

```ini
DB_HOST=localhost
DB_PORT=3306
DB_USER=asset_dev
DB_PASSWORD=aa123456
DB_NAME=game_asset_center
```

## 2. 后端部署

### 安装依赖

进入 `backend` 目录并安装依赖：

```bash
cd backend
npm install
```

### 配置文件

确保 `backend/.env` 文件存在并配置正确。关键配置项：

- `STORAGE_LOCAL_ROOT`: 资产存储的绝对路径。
  ```ini
  STORAGE_LOCAL_ROOT=d:/0Dev/Trae_Project/ResHub/storage
  ```
- `JWT_SECRET`: 用于 Token 签名的密钥，生产环境请修改。

### 初始化数据

如果需要重置数据库或填充演示数据，可以运行：

```bash
# 运行数据库迁移（创建表结构）
npm run migrate

# 填充演示数据（包含用户和资产）
node scripts/seed_demo.js
```

### 启动后端

```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

后端服务默认运行在 `http://localhost:3000`。

## 3. 前端部署

### 安装依赖

进入 `frontend` 目录并安装依赖：

```bash
cd frontend
npm install
```

### 配置文件

确保 `frontend/.env.development` (开发) 或 `.env.production` (生产) 配置了正确的 API 地址：

```ini
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

### 启动前端

```bash
# 开发模式
npm run dev
```

开发服务器默认运行在 `http://localhost:5173`。

### 构建生产版本

```bash
npm run build
```

构建完成后，`dist` 目录下的文件可以部署到 Nginx 或其他静态文件服务器。

## 4. 高级配置与独立部署

### 独立部署 MySQL

如果你希望使用现有的 MySQL 服务器（而非项目自带的本地版），请按以下步骤操作：

1.  **准备数据库**：
    在你的 MySQL 服务器中创建一个空数据库（推荐名为 `game_asset_center`）。

2.  **导入 SQL**：
    使用项目提供的 SQL 脚本初始化数据库结构和基础数据。脚本位置：
    `backend/sql/init_full.sql`

    该脚本会创建所有必要的表，并插入一个默认管理员账号（用户：`admin`，密码：`admin123`）以及基础的项目分类结构。

3.  **修改配置**：
    更新 `backend/.env` 文件中的数据库连接信息：

    ```ini
    DB_HOST=你的MySQL服务器IP
    DB_PORT=3306
    DB_USER=你的数据库用户名
    DB_PASSWORD=你的数据库密码
    DB_NAME=game_asset_center
    ```

### 详细配置说明

#### 后端配置 (`backend/.env`)

| 配置项 | 说明 | 默认值/示例 |
| :--- | :--- | :--- |
| `PORT` | 后端服务监听端口 | `3000` |
| `DB_HOST` | 数据库主机地址 | `localhost` |
| `DB_PORT` | 数据库端口 | `3306` |
| `DB_USER` | 数据库用户名 | `asset_dev` |
| `DB_PASSWORD` | 数据库密码 | `aa123456` |
| `DB_NAME` | 数据库名称 | `game_asset_center` |
| `STORAGE_LOCAL_ROOT` | **关键**：资产文件在服务器上的物理存储路径（绝对路径） | `d:/.../ResHub/storage` |
| `JWT_SECRET` | Token 签名密钥（生产环境务必修改） | `reshub-dev-secret` |
| `ALLOWED_EXTS` | 允许上传的文件扩展名（逗号分隔） | `png,jpg,glb,...` |

#### 前端配置 (`frontend/.env.development` / `.env.production`)

| 配置项 | 说明 | 默认值/示例 |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | 后端 API 的基础地址。如果前后端部署在不同域名/端口，需确保此地址正确指向后端。 | `http://localhost:3000/api/v1` |

## 5. 生产环境优化建议

为了保障系统在生产环境的稳定性与安全性，建议进行以下优化：

### 进程管理 (PM2)

建议使用 PM2 来管理后端 Node.js 进程，支持自动重启和日志管理。

1.  **安装 PM2**:
    ```bash
    npm install -g pm2
    ```

2.  **启动服务**:
    在 `backend` 目录下，项目已内置 `ecosystem.config.js` 配置文件：
    ```bash
    pm2 start ecosystem.config.js --env production
    ```

3.  **常用命令**:
    *   查看状态: `pm2 status`
    *   查看日志: `pm2 logs`
    *   重启服务: `pm2 restart reshub-backend`

### Web 服务器配置 (Nginx)

建议使用 Nginx 作为反向代理服务器，直接处理静态资源（前端页面和上传的文件），以减轻 Node.js 压力并提升安全性。

**Nginx 配置示例 (`nginx.conf`)**:

```nginx
server {
    listen 80;
    server_name your-domain.com; # 替换为你的域名或IP

    # 1. 前端静态文件 (Vite 构建后的 dist 目录)
    location / {
        root /path/to/ResHub/frontend/dist; # 替换为实际路径
        try_files $uri $uri/ /index.html;
        index index.html;
    }

    # 2. 资产文件存储 (直接由 Nginx 服务，提升性能)
    location /storage/ {
        alias /path/to/ResHub/storage/; # 替换为 STORAGE_LOCAL_ROOT 的实际路径
        autoindex off;
        expires 30d;
    }

    # 3. 后端 API 反向代理
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### 安全性加固

*   **防火墙**: 仅开放 80/443 (Web) 和 SSH 端口，禁止外部直接访问 3000 (Node) 或 3306 (MySQL)。
*   **HTTPS**: 强烈建议配置 SSL 证书（如使用 Let's Encrypt），启用 HTTPS 加密通信。
*   **CORS**: 在 `backend/.env` 中配置 `ALLOWED_ORIGINS`，仅允许你的前端域名访问 API。

## 常见问题排查

### 1. 数据库连接失败 (ECONNREFUSED)
- 检查 MySQL 服务是否已启动。
- 检查 `backend/.env` 中的端口和密码是否匹配。

### 2. 静态资源无法加载 (net::ERR_BLOCKED_BY_ORB)
- 这通常是因为数据库中的文件路径与实际磁盘上的文件不匹配。
- 解决方法：运行 `node scripts/seed_demo.js` 重置数据库记录和生成对应的演示文件。

### 3. 首页预览图不显示
- 首页支持图片、音频 (mp3/wav/ogg) 和 3D 模型 (glb/gltf) 的预览。
- 确保 `STORAGE_LOCAL_ROOT` 配置正确，且文件确实存在于该目录下。

### 4. 端口占用
- 如果 3000 或 5173 端口被占用，请修改 `.env` 文件中的端口配置，或关闭占用端口的进程。
