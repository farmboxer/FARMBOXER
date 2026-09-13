# FarmBoxer WhatsApp 经营中台

GardenTec / Farm Boxer 的 WhatsApp 业务操作系统：知识库、产品匹配、收件箱草稿、市场情报与三日复盘。界面为 **zh-CN**。

**硬约束：** 当前销售假设约 ¥1500 万（0.15 亿），五年目标 ¥10 亿；报价与自动回复必须遵守可配置毛利底线（默认 ≥15%）。看板与报告**不编造真实公司业绩**，种子/演示数据一律标注。

## 快速开始

```bash
npm install
npm run dev
```

首次 `npm run dev` 会：若缺失则从 `.env.example` 复制 `.env` → `prisma generate` → `prisma db push` → 在空库时写入样本数据。浏览器打开 [http://localhost:3000](http://localhost:3000)。

单独初始化数据库：

```bash
cp .env.example .env
npm run db:setup
```

跑测试：

```bash
npm test
```

## 环境变量

见 [.env.example](./.env.example)。

| 变量 | 说明 |
| --- | --- |
| `DATABASE_URL` | 默认 SQLite `file:./dev.db`（相对 `prisma/`） |
| `WA_*` | WhatsApp Cloud API。**留空 = DEMO/MOCK**，可在收件箱手工注入，不会真实外发 |
| `OPENAI_API_KEY` | 可选。有则润色草稿，无则模板/规则回复 |
| `MARGIN_FLOOR_PERCENT` | 毛利底线，默认 15 |

Webhook（真实模式）：`GET/POST /api/whatsapp/webhook`。

## 定时任务

每日市场情报（按 WhatsApp 客户出现过的国家跑适配器，结果待人工批准入库）：

```bash
npm run job:market
```

每三日复盘（客户分层、产品快照、竞品、直率批评与通向 10 亿的动作；可导出 Markdown/HTML）：

```bash
npm run job:review
```

也可在界面「市场情报」「三日复盘」一键触发，效果相同。

建议 cron（需本机已 `npm run db:setup`）：

```cron
0 6 * * * cd /path/to/FARMBOXER && npx tsx scripts/job-market.ts
0 7 */3 * * cd /path/to/FARMBOXER && npx tsx scripts/job-review.ts
```

## 模块

1. **经营看板** — 0.15 亿→10 亿路径数学、CAGR、毛利 KPI、会话/知识库/漏斗、告警  
2. **知识库** — 产品参数 / 报价话术 / 售后 / 竞品 / 市场情报 / 方案配置；检索供回复引擎使用  
3. **产品与方案** — 规格、目录价/底价/成本、毛利、目标市场；匹配器偏好 ≥15% 毛利  
4. **WhatsApp 收件箱** — MOCK + Webhook；入站已读 → 知识库+产品匹配 → 草稿；高置信且打开自动回复才外发，否则进批准队列；手机号识别国家  
5. **市场情报** — 适配器（seed / 手工 / 抓取桩）  
6. **三日复盘** — 批评与行动清单  
7. **设置** — 凭证、自动回复、毛利底线、目标、CSV 导入  

成功标准自测：新增一条知识库 → 收件箱注入 MOCK 询盘 → 草稿应引用该条目；产品页「排序推荐」应把低毛利 SKU 降权。

## 切换 Postgres

1. 把 `prisma/schema.prisma` 的 `provider` 改为 `postgresql`，`DATABASE_URL` 改为 Postgres 连接串。  
2. 将 FTS5 相关调用（`src/lib/fts.ts`）换成 Postgres `tsvector` / `websearch_to_tsquery`，或先依赖现有的词法打分（已是中文可用的回退）。  
3. `npx prisma migrate dev`。SQLite 的 `knowledge_fts` 虚表不要迁到 Postgres。

## 技术栈

Next.js App Router · TypeScript · Tailwind CSS · shadcn 风格组件 · Prisma · SQLite · Vitest

本仓库原先是 GitHub 个人简介 README；现已落地为可运行的经营中台。后续如需微信小程序，可包同一套 API，不阻塞 Web。
