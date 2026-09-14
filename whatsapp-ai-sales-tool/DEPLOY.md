# 部署指南（wa.chinagardentec.com）

本工具是 Node 单进程：静态前端 + `/webhook` + `/api/*`。生产应 **把全部 HTTP 反代给 Node**，不要把应用目录当成 nginx `root`。

## 1. 服务器布局

```text
/opt/whatsapp-ai-sales-tool/          # 代码
  server.js
  index.html
  app.js
  styles.css
  config.example.json
  config.local.json                   # 仅本机，权限 0600，不进 git
  data/                               # inbox / outbox / webhook-ops，不对外
```

```bash
cd /opt/whatsapp-ai-sales-tool
cp config.example.json config.local.json
chmod 600 config.local.json
# 填入永久 System User Token、Verify Token、App Secret
npm start
# 或 systemd / pm2 守护 127.0.0.1:8789
```

## 2. nginx：先 deny 密钥，再全部反代

使用仓库内样本：`deploy/nginx-whatsapp-webhook.conf`。

关键点：

- **不要** `root /opt/whatsapp-ai-sales-tool;` 再 `try_files $uri @node;`。现存文件会被 nginx 直接读出去。
- 对下列路径显式 `deny all`：
  - `/config.local.json`、`/config.json`、`/config.*.json`
  - `/data/`
  - `/server.js`
  - `/package.json`、`/package-lock.json`
  - `/node_modules/`
  - `/.env*`
  - 部署压缩包 `*.zip` / `*.tar.gz` 等
  - `/deploy/`
- `/`、`/webhook`、`/api/` 一律 `proxy_pass` 到 `127.0.0.1:8789`。
- Node 侧还有静态 allow-list：只提供 `index.html`、`styles.css`、`app.js`、`favicon.ico`。

部署后立刻自检（均应为 403 或 404，且响应里不能出现 access token）：

```bash
for p in /config.local.json /server.js /package.json /data/whatsapp-inbox.json /.env /app.zip; do
  echo "== $p =="
  curl -sI "https://wa.chinagardentec.com$p" | head -5
done
```

## 3. Meta Webhook

- Callback URL：`https://wa.chinagardentec.com/webhook`
- Verify Token：与 `config.local.json` 一致
- 订阅：`messages`
- 改 Token / Secret / URL 后重新 Verify 并确认订阅仍在

## 4. 健康检查

```bash
curl -s https://wa.chinagardentec.com/api/status
```

关注字段（不会回传原始 Token / Secret）：

- `configured`：本地字段是否填了
- `tokenValid`：Graph 是否接受当前 Token
- `tokenError` / `tokenErrorCode`：例如 190 Session expired
- `appSecretEnabled`：生产应为 `true`
- `receive.lastVerifyAt` / `receive.lastInboundAt`：Meta 是否打到本机

设置页「检查连接」走同一个接口。字段已填写但 `tokenValid=false` 时，按 `WHATSAPP_SETUP.md` 轮换永久 System User Token。

## 5. Token 泄露应急

历史版本曾把应用目录当静态根，导致 `config.local.json` 可被下载。上线本版本后：

1. 作废并轮换 System User Token 与 Verify Token。
2. 生产写入 `appSecret`，重启进程。
3. 套用本仓库 nginx deny 规则。
4. Meta 后台重新验证 Webhook 并订阅 `messages`。
5. 再跑一遍上面的路径自检和 `/api/status`。
