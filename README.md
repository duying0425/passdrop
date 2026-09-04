# 🔐 PassDrop - 压缩包临时密码发放服务

PassDrop 是一个专为文件传输场景打造的极简、自毁型临时密码分发系统。主要用于为发送给他人的加密压缩包（如 `.zip`、`.7z`、`.rar`）生成并提供阅后即焚的解压密码。

---

## ✨ 核心特性

- 🚀 **完全公开，免登录**：无繁琐用户体系，开箱即用。
- 🕒 **双重失效策略**：
  - **时间维度**：默认 2 小时后自动过期失效。
  - **次数维度**：默认被提取 3 次后立即销毁。
  - 无论哪个条件先满足，密码均立即失效。
- 🛡️ **防误操作安全警示**：
  - 发件人输入已存在的文件名重新生成密码时，系统自动弹出高危警示弹窗，明确提示“重新生成将永久清除旧密码，原压缩包将无法再解密”，防止误触覆盖。
- 🧩 **智能文件名容错**：
  - 自动剥离常见压缩包后缀（如用户输入 `财务报表.zip` 或 `财务报表` 均可精确命中）。
  - 大小写不敏感及前后空格自动去除。
- 🔗 **一键直达分享链接**：
  - 发件人生成密码后，可直接复制形如 `https://passdrop.tmhcorps.cn/?f=文件名` 的链接发给收件人，收件人点开自动提取，无需手动打字。
- 🐳 **轻量 Docker 化**：
  - 资源占用极低（内存 < 30MB），自带 SQLite 数据持久化与定期垃圾回收清理任务。
  - 原生适配群晖 Synology、威联通 QNAP、unRAID、TrueNAS 等主流 NAS。

---

## 🛠️ 配置项说明

所有参数均可通过环境变量或 `.env` 配置文件进行自定义：

| 环境变量名 | 默认值 | 详细说明 |
| :--- | :--- | :--- |
| `SITE_TITLE` | `PassDrop - 压缩包临时密码发放` | 网站顶部展示的站点标题 |
| `BASE_URL` | `https://passdrop.tmhcorps.cn` | 站点对外访问域名，用于拼接直达分享链接 |
| `DEFAULT_EXPIRE_HOURS` | `2` | 默认密码有效期（小时，支持小数如 0.5） |
| `DEFAULT_MAX_VIEWS` | `3` | 默认最大允许查看/提取密码的次数 |
| `PASSWORD_LENGTH` | `16` | 自动随机生成密码的长度（大小写字母+数字混合，默认 16 位） |
| `DATABASE_PATH` | `/data/passdrop.db` | SQLite 数据库文件存储路径 |
| `PORT` | `8000` | 容器内服务监听端口（映射到宿主机端口在 compose 中调整） |

---

## 🚀 部署指南（Docker & NAS）

### 方案一：使用 Docker Compose 一键部署（推荐）

1. 将本项目文件上传或 `git clone` 至您的 NAS 或 Linux 服务器目录（例如 `/volume1/docker/passdrop`）。
2. 在该目录下执行启动命令：

```bash
docker compose up -d
```

3. 启动后，服务将在宿主机 `8080` 端口运行（可通过修改 `docker-compose.yml` 中的 `8080:8000` 映射为您喜欢的端口）。

---

### 方案二：主流 NAS 界面化部署步骤

#### 1. 群晖 Synology（Container Manager）
1. 打开 **Container Manager** -> **项目 (Project)** -> 点击 **新增**。
2. 项目名称输入 `passdrop`，路径选择存放本项目文件的文件夹（确保包含 `docker-compose.yml` 和 `data/` 目录）。
3. 选择“使用现有的 docker-compose.yml 构建项目”，点击下一步并完成创建即可。

#### 2. 威联通 QNAP（Container Station）
1. 打开 **Container Station** -> **应用程序 (Applications)** -> 点击 **创建 (Create)**。
2. 填入应用名称 `passdrop`，将 `docker-compose.yml` 的内容粘贴进编辑器，点击创建即可。

#### 3. 1Panel / Portainer / unRAID
- 直接导入 `docker-compose.yml`，挂载卷 `./data:/data` 即可启动。

---

## 🌐 域名与反向代理配置 (`passdrop.tmhcorps.cn`)

若您要使用自己的域名 `passdrop.tmhcorps.cn` 并开启 HTTPS，可选用以下任一方式：

### 1. Nginx 配置文件示例

```nginx
server {
    listen 80;
    server_name passdrop.tmhcorps.cn;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name passdrop.tmhcorps.cn;

    ssl_certificate /path/to/passdrop.tmhcorps.cn.crt;
    ssl_certificate_key /path/to/passdrop.tmhcorps.cn.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://127.0.0.1:8080;  # 宿主机映射的端口
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 2. Nginx Proxy Manager (NPM) 图形化反代
- **Domain Names**: `passdrop.tmhcorps.cn`
- **Scheme**: `http`
- **Forward Hostname / IP**: `宿主机局域网IP 或 127.0.0.1`
- **Forward Port**: `8080`
- **SSL**: 勾选 `Request a new SSL Certificate`，并开启 `Force SSL` 与 `HTTP/2 Support`。

### 3. Caddy 配置示例
```caddyfile
passdrop.tmhcorps.cn {
    reverse_proxy localhost:8080
}
```

---

## 💻 本地开发与调试

```bash
# 1. 安装依赖
pip install -r requirements.txt

# 2. 运行自动化测试
pytest tests/ -v

# 3. 本地启动服务
python -m uvicorn app.main:app --reload --port 8000
```

访问：`http://127.0.0.1:8000`

---

## 📦 Git 版本托管

若您需要将代码推送到自己的 GitHub / Gitee / 私有 Gitea 仓库：

```bash
# 初始化 Git 仓库
git init

# 添加所有代码并提交
git add .
git commit -m "feat: Initial release of PassDrop password sharing service"

# 关联远程仓库并推送
git branch -M main
git remote add origin <您的 Git 仓库地址，例如 git@github.com:username/passdrop.git>
git push -u origin main
```

