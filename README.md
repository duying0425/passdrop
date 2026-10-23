# 🔐 PassDrop - 压缩包临时密码发放服务

PassDrop 是一个专为文件传输场景打造的极简、阅后即焚型临时密码分发系统。主要用于为发送给他人的加密压缩包（如 `.zip`、`.7z`、`.rar`、`.tar.gz` 等）快速生成、管理并在满足条件后自动销毁解压密码。

支持 **Web 交互界面**、**网页后缀 URL 传参直达** 以及 **RESTful API 自动化集成** 三种使用方式。

---

## ✨ 核心特性

- 🚀 **完全公开，免登录**：无繁琐注册/登录体系，即用即走。
- 🕒 **双重失效策略**：
  - **时间维度**：默认 2 小时后自动过期失效（支持自定义 0.1 ~ 720 小时）。
  - **次数维度**：默认被提取 1 次后立即销毁（阅后即焚，支持自定义 1 ~ 1000 次）。
  - 无论哪个条件先满足，密码均立即永久销毁。
- 🛡️ **防误操作高危警示**：
  - 发件人输入已存在的文件名重新生成时，系统弹出高危二次确认弹窗，明确提示“重新生成将清除旧密码，原压缩包可能无法再解密”，杜绝误触覆盖。
- 🧩 **智能文件名容错**：
  - 自动剥离常见压缩包后缀（如用户输入 `财务报表.zip` 或 `财务报表` 均可精确命中同一个文件）。
  - 自动去除首尾空格、大小写自动规范化。
- 🔗 **网页后缀 URL 传参**：
  - 支持 `?f=文件名` 或 `?file=文件名`，点开链接自动填充并定位提取，收件人 0 打字成本。
- 🌐 **多语言界面（简体中文 / English / 日本語）**：
  - 根据浏览器语言自动显示，右上角可随时切换（无需刷新页面，不会额外消耗提取次数）。
  - API 错误信息同样支持三种语言，并附带稳定的错误码 `code` 便于脚本判断。
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
> 若文件已有未失效密码且未指定 `"force": true`，将返回 `"ok": false, "code": "EXISTS"`（附带旧记录信息 `existing`）阻止意外覆盖。若确认覆盖请传入 `"force": true`。

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
> 次数耗尽或过期后再次调用将返回 `"ok": false` 并通过 `code` / `message` 说明原因（见下方错误码）。

##### ③ 错误响应与多语言

业务类错误返回 HTTP `200` 与 `"ok": false`，并包含稳定的错误码 `code` 和本地化的提示 `message`：

```json
{
  "ok": false,
  "code": "EXHAUSTED",
  "message": "This password has reached its retrieval limit and is no longer available.",
  "status": "expired_or_not_found"
}
```

| `code` | 含义 |
| :--- | :--- |
| `INVALID_FILENAME` | 文件名去除首尾空格后为空 |
| `NOT_FOUND` | 未找到该文件名的记录 |
| `EXHAUSTED` | 提取次数已用尽 |
| `EXPIRED` | 已超过有效期 |
| `REVOKED` | 已失效或已被销毁 |
| `EXISTS` | 生成时发现同名有效记录（需 `force: true` 才能覆盖） |

> 请求参数本身不合法时（如 `filename` 为空字符串或超过 200 字符、`expire_hours` 不在 (0, 720]、`max_views` 不在 [1, 1000]、`custom_password` 超过 64 字符），由 FastAPI 返回 HTTP `422` 及 `detail` 数组，不含 `code` / `message`。

`message` 的语言按以下优先级决定：URL 参数 `?lang=zh|en|ja` → Cookie `passdrop_lang` → 请求头 `Accept-Language` → 配置项 `DEFAULT_LANG`（默认中文）。
脚本调用时建议根据 `code` 判断结果，例如 `POST /api/fetch?lang=en` 即可获得英文提示；未指定语言的 cURL / PowerShell / Python 脚本保持返回中文，与旧版本兼容。

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

## 🌐 多语言支持（简体中文 / English / 日本語）

### 语言如何确定

页面与 API 按以下优先级选择语言，任一命中即生效：

1. URL 参数 `?lang=zh` / `?lang=en` / `?lang=ja`（页面访问时会写入 Cookie 记住选择）
2. Cookie `passdrop_lang`（用户在右上角切换语言时写入，有效期 1 年）
3. 浏览器请求头 `Accept-Language`（如 `ja-JP`、`en-US`、`zh-TW` 均可识别）
4. 配置项 `DEFAULT_LANG`（默认 `zh`）

- 页面由服务端直接按所选语言渲染，无闪烁；右上角切换语言时**不刷新页面**，因此通过 `?f=` 链接打开的提取结果不会因切换语言而再次消耗提取次数。
- 分享链接不附带语言参数，收件人会自动看到自己浏览器语言的界面。

### 翻译文件维护

所有文案集中在 `app/locales/` 目录，三种语言各一个 JSON 文件（以 `zh.json` 为基准）：

```text
app/locales/zh.json   # 简体中文（基准，缺失的键会回退到这里）
app/locales/en.json   # English
app/locales/ja.json   # 日本語
```

- **修改文案**：直接编辑对应 JSON 中的值即可；`{name}`、`{count}` 等占位符和 `<strong>` 标签需在三种语言中保持一致。
- **新增文案**：在三个文件中添加同一个键，模板中使用 `{{ t('键名') }}` 并加上 `data-i18n="键名"`（切换语言时自动更新），脚本中使用 `t("键名")`。
- **新增语言**：新建 `app/locales/<代码>.json`，并在 `app/i18n.py` 的 `LANGUAGES` 中登记名称与 `<html lang>` 值。
- **自动校验**：`pytest` 会检查各语言的键、占位符与 HTML 标签是否一致，以及模板 / 脚本引用的键是否都已定义，提交前运行即可发现漏翻。

---

## 🛠️ 配置项说明

所有参数均可通过环境变量或 `.env` 配置文件进行自定义：

| 环境变量名 | 默认值 | 详细说明 |
| :--- | :--- | :--- |
| `SITE_TITLE` | 空 | 可选。留空时按页面语言显示本地化标题；设置后所有语言统一使用该标题 |
| `DEFAULT_LANG` | `zh` | 默认语言（`zh` / `en` / `ja`），无法从 URL、Cookie 或浏览器语言匹配时使用 |
| `BASE_URL` | `https://passdrop.tmhcorps.cn` | 站点对外访问基础域名，用于拼接直达分享链接 |
| `DEFAULT_EXPIRE_HOURS` | `2` | 默认密码有效期（小时，支持小数如 0.5） |
| `DEFAULT_MAX_VIEWS` | `1` | 默认最大允许查看/提取密码的次数 |
| `PASSWORD_LENGTH` | `16` | 自动随机生成密码的长度（大小写字母+数字混合） |
| `DATABASE_PATH` | `/data/passdrop.db` | SQLite 数据库文件存储路径 |
| `PORT` | `8000` | 容器内部服务监听端口 |

---

## 🚀 部署指南（Docker & 群晖 NAS）

### 宿主机端口分配

PassDrop 在宿主机上使用端口 **`8082`**（容器内端口 `8000`），默认仅绑定本机回环地址，只允许同机的 Nginx 等反向代理访问：
```yaml
ports:
  - "127.0.0.1:8082:8000"
```
> 若反向代理运行在另一台设备上（如 NAS 局域网内其他主机上的 Nginx Proxy Manager），需改为 `"8082:8000"` 以监听所有网卡。

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

### 云服务器（如阿里云）通过 GitHub 更新

云服务器上同样以 Git 仓库 + Docker Compose 方式运行（例如 `~/passdrop`，端口仅绑定 `127.0.0.1:8082` 供 Nginx 反代）。本地修改推送到 GitHub 后，在服务器执行：

```bash
ssh aliyun
cd ~/passdrop
git pull --ff-only
docker-compose build                     # 先构建新镜像，旧容器继续提供服务
docker rm -f passdrop && docker-compose up -d
curl -s http://127.0.0.1:8082/health   # 返回 {"status":"ok"} 即更新成功
```

> - 服务器访问 GitHub 的 HTTPS 不稳定时，请使用 SSH 地址作为远程仓库：`git remote set-url origin git@github.com:duying0425/passdrop.git`。
> - 旧版 docker-compose（1.29.x）配合新版 Docker 直接 `up -d --build` 重建已有容器时会报 `KeyError: 'ContainerConfig'` 并导致服务中断，因此先 `docker rm -f passdrop` 再启动（数据位于 `./data` 挂载目录，不受影响）。
> - 若服务器上有未提交的本地修改（如 `docker-compose.yml` 中的端口绑定）导致 `git pull` 失败，可先 `git stash`，拉取后再 `git stash pop` 恢复。

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
