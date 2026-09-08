# 🔐 PassDrop - 压缩包临时密码发放服务

PassDrop 是一个专为文件传输场景打造的极简、阅后即焚型临时密码分发系统。主要用于为发送给他人的加密压缩包（如 `.zip`、`.7z`、`.rar`、`.tar.gz` 等）快速生成、管理并在满足条件后自动销毁解压密码。

支持 **Web 交互界面**、**网页后缀 URL 传参直达** 以及 **RESTful API 自动化集成** 三种使用方式。

---

## ✨ 核心特性

- 🚀 **完全公开，免登录**：无繁琐注册/登录体系，即用即走。
- 🕒 **双重失效策略**：
  - **时间维度**：默认 2 小时后自动过期失效（支持自定义 0.1 ~ 720 小时）。
  - **次数维度**：默认被提取 3 次后立即销毁（支持自定义 1 ~ 1000 次）。
  - 无论哪个条件先满足，密码均立即永久销毁。
- 🛡️ **防误操作高危警示**：
  - 发件人输入已存在的文件名重新生成时，系统弹出高危二次确认弹窗，明确提示“重新生成将清除旧密码，原压缩包可能无法再解密”，杜绝误触覆盖。
- 🧩 **智能文件名容错**：
  - 自动剥离常见压缩包后缀（如用户输入 `财务报表.zip` 或 `财务报表` 均可精确命中同一个文件）。
  - 自动去除首尾空格、大小写自动规范化。
- 🔗 **网页后缀 URL 传参**：
  - 支持 `?f=文件名` 或 `?file=文件名`，点开链接自动填充并定位提取，收件人 0 打字成本。
- ⚡ **完备的 RESTful API**：
  - 方便结合本地脚本、CI/CD、自动化打包脚本（Python / PowerShell / Shell）实现全流程无感打包上报密码。
- 🐳 **轻量 Docker 化**：
  - 镜像内存占用 < 30MB，基于 SQLite 磁盘持久化，后台自动定时清理过期失效数据。
  - 原生适配群晖 Synology、威联通 QNAP、unRAID、TrueNAS 等主流 NAS 与各类 Linux 服务器。

---

## 🎯 三种使用方式

### 方式一：Web 浏览器使用

直接通过浏览器访问 `https://passdrop.tmhcorps.cn`：

1. **生成密码（发件人）**：
   - 切换到「生成密码」标签页。
   - 输入压缩包文件名（可带或不带 `.zip` 后缀）。
   - 可选高级设置：调整有效时间、最大提取次数、或指定自定义密码。
   - 点击生成，系统提供**一键复制密码**以及**一键复制分享链接**。
2. **提取密码（收件人）**：
   - 切换到「提取密码」标签页。
   - 输入收件文件名，点击「提取密码」即可查看，并展示剩余提取次数与剩余有效时间。

---

### 方式二：网页后缀 / URL 传参直达

通过在 URL 末尾附带参数，可直接跳过收件人手动输入文件名的步骤：

- **参数格式**：
  - `https://passdrop.tmhcorps.cn/?f=文件名`
  - `https://passdrop.tmhcorps.cn/?file=文件名`
- **示例**：
  - `https://passdrop.tmhcorps.cn/?f=2026财务审计报告.zip`
  - `https://passdrop.tmhcorps.cn/?f=project-v2.1`
- **效果**：
  - 页面加载时会自动解析 URL 中的文件名并填充进输入框，直接切换到「提取密码」面板并聚焦提取按钮，收件人点击即可提取查看，极大提升用户体验。

---

### 方式三：RESTful API 自动化集成

PassDrop 提供了完整的 HTTP API，方便集成到各类脚本或外部系统中。

#### 1. 核心接口清单

| 接口地址 | 请求方法 | 功能说明 |
| :--- | :--- | :--- |
| `/health` | `GET` | 容器健康检查（返回 `{"status":"ok"}`） |
| `/api/config` | `GET` | 获取站点公开配置（默认有效期、默认次数等） |
| `/api/generate` | `POST` | 为压缩包生成/登记密码 |
| `/api/fetch` | `POST` | 提取密码（每成功提取一次，扣减 1 次剩余次数） |
| `/api/clear` | `POST` | 提前手动作废并清除指定文件的密码 |

---

#### 2. 接口调用示例

##### ① 生成/登记密码 (`POST /api/generate`)

**请求体 (JSON)**：
```json
{
  "filename": "backup_2026.zip",
  "expire_hours": 2,
  "max_views": 3,
  "custom_password": null,
  "force": false
}
```
> 若文件已有未失效密码且未指定 `"force": true`，将返回 `409 Conflict` 阻止意外覆盖。若确认覆盖请传入 `"force": true`。

**响应体 (JSON)**：
```json
{
  "ok": true,
  "filename": "backup_2026",
  "password": "xK9#mQ2$pL8*vN1!",
  "expires_at": 1788540473,
  "expire_hours": 2.0,
  "max_views": 3,
  "share_url": "https://passdrop.tmhcorps.cn/?f=backup_2026",
  "is_overwrite": false
}
```

##### ② 提取密码 (`POST /api/fetch`)

**请求体 (JSON)**：
```json
{
  "filename": "backup_2026.zip"
}
```

**响应体 (JSON)**：
```json
{
  "ok": true,
  "filename": "backup_2026",
  "password": "xK9#mQ2$pL8*vN1!",
  "views_left": 2,
  "view_count": 1,
  "max_views": 3,
  "seconds_left": 7180,
  "expires_at": 1788540473
}
```
> 次数耗尽或过期后再次调用将返回 `404 Not Found` 并提示密码已失效。

---

#### 3. 代码集成示例

##### cURL 示例
```bash
# 1. 自动生成密码
curl -s -X POST https://passdrop.tmhcorps.cn/api/generate \
  -H "Content-Type: application/json" \
  -d '{"filename": "project.zip", "expire_hours": 4, "max_views": 3}'

# 2. 提取密码
curl -s -X POST https://passdrop.tmhcorps.cn/api/fetch \
  -H "Content-Type: application/json" \
  -d '{"filename": "project.zip"}'
```

##### Python 自动化打包分发脚本示例
```python
import httpx

API_BASE = "https://passdrop.tmhcorps.cn"
FILE_NAME = "release_v1.0.zip"

# 1. 向 PassDrop 申请密码
res = httpx.post(f"{API_BASE}/api/generate", json={
    "filename": FILE_NAME,
    "expire_hours": 24,
    "max_views": 5
})
data = res.json()
password = data["password"]
share_link = data["share_url"]

print(f"生成的解压密码为: {password}")
print(f"收件人提取链接: {share_link}")

# 2. 调用 7-Zip 或 zipfile 使用该 password 进行压缩加密即可...
```

##### PowerShell 脚本示例
```powershell
$body = @{
    filename     = "Data_2026.zip"
    expire_hours = 2
    max_views    = 3
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "https://passdrop.tmhcorps.cn/api/generate" `
                              -Method Post `
                              -ContentType "application/json" `
                              -Body $body

Write-Host "密码: $($response.password)"
Write-Host "提取链接: $($response.share_url)"
```

---

## 🛠️ 配置项说明

所有参数均可通过环境变量或 `.env` 配置文件进行自定义：

| 环境变量名 | 默认值 | 详细说明 |
| :--- | :--- | :--- |
| `SITE_TITLE` | `PassDrop - 压缩包临时密码发放` | 网站顶部展示的站点标题 |
| `BASE_URL` | `https://passdrop.tmhcorps.cn` | 站点对外访问基础域名，用于拼接直达分享链接 |
| `DEFAULT_EXPIRE_HOURS` | `2` | 默认密码有效期（小时，支持小数如 0.5） |
| `DEFAULT_MAX_VIEWS` | `1` | 默认最大允许查看/提取密码的次数 |
| `PASSWORD_LENGTH` | `16` | 自动随机生成密码的长度（大小写字母+数字混合） |
| `DATABASE_PATH` | `/data/passdrop.db` | SQLite 数据库文件存储路径 |
| `PORT` | `8000` | 容器内部服务监听端口 |

---

## 🚀 部署指南（Docker & 群晖 NAS）

### 宿主机端口分配

PassDrop 在 NAS 宿主机上使用端口 **`8082`**（容器内端口 `8000`）：
```yaml
ports:
  - "8082:8000"
```

### 方案一：使用 Git + Docker Compose 部署（推荐）

1. 登录 NAS 终端：
```bash
ssh nas
```

2. 克隆代码库至 Docker 项目目录（例如 `/volume2/docker/passdrop`）：
```bash
git clone git@github.com:duying0425/passdrop.git /volume2/docker/passdrop
cd /volume2/docker/passdrop
```

3. 一键构建并启动容器：
```bash
docker-compose up -d --build
```

4. **后续代码更新（标准 Git 流程）**：
```bash
cd /volume2/docker/passdrop
git pull
docker-compose up -d --build
```

---

### 方案二：主流 NAS 界面化部署步骤

#### 1. 群晖 Synology（Container Manager）
1. 打开 **Container Manager** -> **项目 (Project)** -> 点击 **新增**。
2. 项目名称输入 `passdrop`，路径选择存放本项目文件的文件夹（确保包含 `docker-compose.yml` 和 `data/` 目录）。
3. 选择“使用现有的 docker-compose.yml 构建项目”，点击下一步并完成创建即可。

#### 2. 威联通 QNAP（Container Station）
1. 打开 **Container Station** -> **应用程序 (Applications)** -> 点击 **创建 (Create)**。
2. 填入应用名称 `passdrop`，将 `docker-compose.yml` 的内容粘贴进编辑器，点击创建即可。

---

## 🌐 域名与反向代理配置 (`passdrop.tmhcorps.cn`)

将域名 `passdrop.tmhcorps.cn` 解析并反向代理至 NAS 的 `8082` 端口。

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
        proxy_pass http://127.0.0.1:8082;  # NAS 宿主机映射的端口 8082
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
- **Forward Hostname / IP**: `127.0.0.1`（或 NAS 局域网 IP `192.168.1.2`）
- **Forward Port**: `8082`
- **SSL**: 申请证书并勾选 `Force SSL` 与 `HTTP/2 Support`。

### 3. Caddy 配置示例
```caddyfile
passdrop.tmhcorps.cn {
    reverse_proxy 127.0.0.1:8082
}
```

---

## 💻 本地开发与测试

```bash
# 1. 安装依赖
pip install -r requirements.txt

# 2. 运行自动化测试套件
pytest

# 3. 本地启动服务
uvicorn app.main:app --reload --port 8000
```
本地访问地址：`http://127.0.0.1:8000`
