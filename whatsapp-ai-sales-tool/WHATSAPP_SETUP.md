# WhatsApp Business Platform 官方接入清单

生产域名：`https://wa.chinagardentec.com`

## 你需要准备的资料

- Meta Business Manager 管理员权限。
- Meta Developer App。
- WhatsApp Business Account。
- 已绑定并通过验证的 WhatsApp Business 手机号。
- Phone Number ID。
- WhatsApp Business Account ID。
- **永久 System User Token**（不要用会过期的用户登录 Token / 临时 Token）。
- Verify Token：自己生成一串足够长的随机字符串，填在本工具和 Meta 后台两边。
- **App Secret**：生产环境必须填写，用于校验 Webhook `X-Hub-Signature-256`。
- HTTPS 公网域名。当前正式 Callback URL：

```text
https://wa.chinagardentec.com/webhook
```

## 本工具配置

复制配置模板（不要把带密钥的文件提交到 git 或放到可被 nginx 直接读取的目录）：

```bash
cp config.example.json config.local.json
```

编辑 `config.local.json`：

```json
{
  "port": 8789,
  "publicBaseUrl": "https://wa.chinagardentec.com",
  "whatsapp": {
    "graphApiVersion": "v21.0",
    "phoneNumberId": "你的 Phone Number ID",
    "businessAccountId": "你的 WhatsApp Business Account ID",
    "accessToken": "永久 System User Token",
    "verifyToken": "你自己设置的 Verify Token",
    "appSecret": "Meta App Secret（生产必须填写）"
  }
}
```

启动：

```bash
npm start
```

`config.local.json`、`data/**`、`server.js`、`package.json` 和 `.env*` **不得**作为静态文件对外提供。Node 已做 allow-list；nginx 必须同步加上 `deny all`。见 `DEPLOY.md`。

## Meta 后台配置

在 Meta Developer App 的 WhatsApp → Configuration → Webhooks 填写：

- Callback URL：`https://wa.chinagardentec.com/webhook`
- Verify Token：与 `config.local.json` 中的 `verifyToken` 完全一致
- 订阅字段：**必须勾选 `messages`**
- 保存后如改过 Token / Verify Token / Callback URL，重新点击 Verify / 重新订阅

`GET /webhook` 是 Meta 的 challenge 校验，不校验 App Secret 签名。`POST /webhook` 在配置了 `appSecret` 后会拒绝错误签名。

## 创建永久 System User Token

1. 打开 [Meta Business Settings → System Users](https://business.facebook.com/settings/system-users)。
2. 创建或选择一个 System User，分配 WhatsApp 相关资产权限（WhatsApp Business Account / 应用）。
3. Generate New Token：选择对应 App，勾选 WhatsApp 发送/管理所需权限（至少 `whatsapp_business_messaging`、`whatsapp_business_management`）。
4. 选择 **永久 / 不过期** 的 System User Token，不要用个人登录产生的短时 User Token。
5. 把 Token 只写进服务器上的 `config.local.json`，权限 `0600`。
6. 在工具「设置 → 检查连接」确认 `tokenValid=true`，而不仅是「字段已填写」。

## Token 泄露后必须轮换

若 `config.local.json` 曾被 HTTP 公开下载（或仓库/备份泄露）：

1. 在 Business Settings 里 **立刻作废 / 轮换** System User Token。
2. 重新生成 Verify Token，并在 Meta Webhook 页同步更新后重新验证。
3. 如有必要，轮换 App Secret，然后把新 Secret 写入 `config.local.json`。
4. 确认 nginx 已对 `config*.json`、`data/`、`server.js`、`package.json`、`node_modules/`、`.env*`、部署压缩包 `deny all`。
5. 用新 Token 再跑一次「检查连接」，并在 Meta 后台重新订阅 `messages`。

## 工具内验证

打开 `https://wa.chinagardentec.com`（或 `http://127.0.0.1:8789`），进入「设置」，点击「检查连接」。

状态含义：

- **字段已填写**：`phoneNumberId` / `accessToken` / `verifyToken` 非空。这 **不等于** Token 还能用。
- **Graph Token 有效 (`tokenValid`)**：服务器已向 Meta Graph 查询该 Phone Number，Token 当前可用。
- **App Secret 已启用**：生产应为此状态；否则签名校验被跳过。
- **接收诊断**：Webhook 校验次数、最近一次校验时间、最近一次入站时间、签名失败次数。若入站时间一直为空，说明 Meta 没有打到本机（订阅未激活、Token 过期、或 Callback URL 不对）。

客户消息进入 `data/whatsapp-inbox.json` 后，页面点击「同步 WhatsApp」才会进入工作台。该文件不得对外静态下载。

## Token 过期排查（OAuthException 190）

Graph 返回 `OAuthException` code **190**（例如 Session expired）时：

1. 「检查连接」会显示 `tokenValid=false` 和 Graph 错误信息，但字段仍可能显示「已配置」。
2. 到 System Users 重新生成 **永久** Token，覆盖 `config.local.json` 的 `accessToken`。
3. 重启 Node 进程。
4. 再到 Meta Webhooks 页确认 Callback URL 仍是 `https://wa.chinagardentec.com/webhook`，订阅 `messages` 仍为已勾选；必要时重新 Verify。
5. 用 Meta 或 curl 再打一次 Graph：`GET /{phone-number-id}?fields=verified_name`，确认 200。
6. 用测试号发一条 WhatsApp，看「接收诊断」的 `lastInboundAt` 是否更新。

## 发送消息流程

1. 客户消息进入队列。
2. 系统生成建议回复。
3. 业务员检查价格、底价、成本、利润和方案。
4. 点击「审核通过」。
5. 点击「发送到 WhatsApp」。

## 风险控制

- 涉及底价、成本、合同、交期承诺、独家代理、付款条款的问题，不建议自动发送。
- 建议前期只做「AI 草稿 + 人工审核」，稳定后再开放高置信度自动回复。
- 不要使用非官方 WhatsApp Web 抓取方式，容易导致账号风险。
- 生产必须设置 `appSecret`。未设置时服务会跳过签名校验（便于本地），但公网暴露时任何人都能伪造入站消息。

## 官方文档

- WhatsApp Business Platform：https://developers.facebook.com/docs/whatsapp/
- WhatsApp Cloud API：https://developers.facebook.com/docs/whatsapp/cloud-api/
- System Users：https://developers.facebook.com/docs/development/create-an-app/app-dashboard/system-users
- Webhooks：https://developers.facebook.com/docs/graph-api/webhooks/getting-started
- WhatsApp Business 开发者中心：https://business.whatsapp.com/developers/developer-hub
