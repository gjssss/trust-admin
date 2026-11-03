# Trust Admin

基于 Next.js App Router 的检测管理平台。保留原项目的综合检测、谣言检测、机器人账号检测、文本溯源和模型设置；增加用户名密码登录、管理员用户管理及服务端鉴权。原三个检测后端的接口保持不变。

## 本地运行

需要 Node.js 24、pnpm 10，以及 SQLite 原生驱动的编译工具（macOS Command Line Tools；Linux 为 Python 3、make、g++）。

```sh
corepack enable
pnpm install --ignore-scripts
PATH="$PWD/node_modules/.bin:$PATH" pnpm rebuild
cp .env.example .env
# 编辑 .env，设置 ADMIN_USERNAME、ADMIN_PASSWORD 和三个服务地址
pnpm dev
```

打开 http://localhost:3000。账号名为 3–64 位字母、数字、下划线、点或短横线，以字母或数字开头；密码为 8–128 个字符。用户名唯一且不区分大小写。

`pnpm dev` 启动前自动初始化 SQLite；首次空数据库必须提供管理员凭据，之后不再重设管理员。默认数据库为 `./data/trust-admin.sqlite`，请勿提交数据库或 `.env`。

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm start
```

生产启动必须设置 `APP_ORIGIN`，其值为浏览器实际访问的 origin（协议、域名和端口，不包含子路径），例如 `https://trust.example.com`。构建过程不需要管理员密码或访问数据库。

## Docker 部署

镜像只包含 Next.js 应用，三个原后端保持原部署方式。使用 Node 24 多阶段构建，以非 root 用户运行；账号数据持久化到 `/app/data`。

```sh
docker build -t trust-admin:local .
```

通过 Compose 部署：

1. 复制 `.env.example` 为 `.env` 并填写初始管理员账号密码。
2. `BACKEND_NETWORK` 填写现有三个服务所在的 Docker 网络。
3. Docker 内上游地址使用对应服务名：`http://fakenews-detector:30101`、`http://mgtab:30102`、`http://aigt:30103`，不要使用容器自身的 localhost。
4. 设置准确的 `APP_ORIGIN`；如更改映射端口，同时修改该值。

```sh
docker compose up -d --build
```

也可直接运行（`.env` 中三个上游需先改为容器可访问的地址）：

```sh
docker run -d --name trust-admin \
  --network YOUR_EXISTING_BACKEND_NETWORK \
  -p 3000:3000 \
  --env-file .env \
  -e DATABASE_PATH=/app/data/trust-admin.sqlite \
  -v trust-admin-data:/app/data \
  trust-admin:local
```

服务位于宿主机时，Docker Desktop 可使用 `host.docker.internal`；Linux Docker 需加入 `--add-host=host.docker.internal:host-gateway`。如使用 bind mount，目录必须允许容器 UID 1000 写入。Compose 使用命名数据卷，无需手动创建目录。

初始化完成后可以移除 `ADMIN_PASSWORD` 环境变量。重启、更换镜像或更改该变量不会覆盖已有密码；后续在用户管理中重置密码。不要删除数据卷，`docker compose down -v` 会丢失账号数据。

## 配置

| 变量 | 用途 |
| --- | --- |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | 仅首次初始化管理员使用，不存在默认密码 |
| `APP_ORIGIN` | 浏览器访问 origin，生产必填；用于来源校验及 HTTPS Secure Cookie |
| `DATABASE_PATH` | SQLite 文件，本地默认 `./data/trust-admin.sqlite`，Docker 为 `/app/data/trust-admin.sqlite` |
| `FAKE_NEWS_UPSTREAM_URL` | 谣言服务 origin，本地默认 `http://localhost:30101` |
| `BOT_DETECTION_UPSTREAM_URL` | 机器人服务 origin，本地默认 `http://localhost:30102` |
| `AIGT_UPSTREAM_URL` | 文本溯源服务 origin，本地默认 `http://localhost:30103` |
| `BACKEND_NETWORK` | Compose 使用的既有 Docker 网络 |
| `PORT` | 本地监听端口或 Compose 对外映射端口，默认 3000 |

三个上游地址只在服务器使用，不进入浏览器代码。路径映射如下：

| 浏览器路径 | 上游路径 |
| --- | --- |
| `/api/fake-news/health` | `/api/health` |
| `/api/bot-detection/bot` | `/bot` |
| `/api/aigt/cn_detect` | `/cn_detect` |

代理保留 JSON、AIGT 表单、multipart 上传、原始编码图片路径、二进制及错误状态。请求体限制为 20 MiB（包含 base64 膨胀或 multipart 开销）；上游等待最长 24 小时。生产反向代理需同步配置请求体与长请求超时。三个后端应保持在受控内部网络，应用的登录不能限制绕过应用直接访问公开的后端端口。

## 登录与用户管理

- 管理员与普通用户都可以使用原有检测和设置功能。
- 管理员在 `/users` 创建用户、修改用户名与角色、重置密码、启用/禁用和删除账号。
- 至少保留一个启用的管理员，删除、降级或禁用最后一个管理员会被拒绝。
- 页面入口、业务代理和用户管理 API 都校验服务端会话；只有登录页、登录请求、必要静态资源及最小健康探针公开。
- 会话有效期为 7 天，Cookie 为 HttpOnly、SameSite=Lax；`APP_ORIGIN` 为 HTTPS 时启用 Secure。注销、重置密码、修改角色或启停账号会撤销相应会话。
- 不提供自助注册和邮件找回密码。任务、聊天、应用目录及其他模板设置页保持演示性质，仍需登录。
- 谣言历史按用户 ID 保存在当前浏览器，账号间不混显。换浏览器或域名不会自动同步；原匿名历史不自动归属。浏览器本地数据不提供对同一设备操作者的加密隔离。

## 数据与运维

当前方案为单实例应用加本地 SQLite，适合单个 Docker 容器。不要让多个容器通过网络文件系统共享此数据库；横向扩容需要改用共享数据库、会话及限流存储。

SQLite 使用 WAL。备份时使用 SQLite 的在线 backup 功能，或停容器后复制整个数据目录（包含 WAL/SHM），不要运行中只复制 `.sqlite` 主文件。例如在有 `sqlite3` 命令的宿主机，对数据卷导出的数据库执行：

```sh
sqlite3 /path/to/trust-admin.sqlite '.backup /path/to/backup.sqlite'
```

`GET /api/health` 只返回应用存活状态，不表示三个检测后端健康。模型与服务状态仍在原设置页面查看。

## 回归验证

`pnpm test` 包含认证、权限、初始化、代理字节契约和服务端渲染测试。生产 HTTP 冒烟脚本应针对独立测试数据库运行，会创建并删除测试用户，并要求目标实例只有一个启用的管理员：

```sh
TEST_ORIGIN=http://localhost:3100 TEST_ADMIN=your_test_admin TEST_PASSWORD=your_test_password node tests/http-smoke.mjs
```

真实后端不可用时，可运行 `node tests/mock-services.mjs` 在本机 30101/30102/30103 启动明确标记的契约测试服务，用于浏览器交互回归；它们不会参与应用的生产构建或启动，不代表真实模型结果。

本项目沿用 Shadcn Admin 的 UI 基础和 MIT 许可，见 [LICENSE](LICENSE)。原接口说明保留在 `docs/`；其中早期 Vite 部署与服务地址说明以本 README 和当前代码为准。
