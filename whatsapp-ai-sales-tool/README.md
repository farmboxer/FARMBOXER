# WhatsApp AI 外贸经营工具

本地 / 生产 MVP：客户消息处理、回复建议、产品与知识库、WhatsApp Cloud API 收发。

生产地址：`https://wa.chinagardentec.com`

## 安全约定

以下路径 **不得** 经 HTTP 提供：`config.local.json`、其它 `config.*.json`（仓库内仅保留无密钥的 `config.example.json`）、`data/**`、`server.js`、`package.json`、`package-lock.json`、`node_modules/**`、`.env*`、部署压缩包。

Node `serveStatic` 使用 allow-list；nginx 样本见 `deploy/nginx-whatsapp-webhook.conf`。密钥只放服务器本机 `config.local.json`。

## 启动

```bash
cp config.example.json config.local.json
# 填入永久 System User Token、Verify Token、生产环境的 App Secret
npm start
```

默认：`http://127.0.0.1:8789`

```bash
npm test
```

## 文档

- 接入、永久 Token、过期排查：`WHATSAPP_SETUP.md`
- nginx 与上线：`DEPLOY.md`

Webhook：`GET/POST /webhook`  
健康检查：`GET /api/status`（区分「字段已填写」与「Graph Token 有效」）
