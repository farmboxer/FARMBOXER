import { CONTACT_TIERS } from "@/lib/constants";
import { computeGoalPath } from "@/lib/goals";
import { listMargin, floorMargin } from "@/lib/margin";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { markdownToHtml } from "@/lib/utils";

export async function runReviewJob() {
  const settings = await getSettings();
  const path = computeGoalPath({
    currentSalesRmb: settings.currentSalesRmb,
    targetSalesRmb: settings.targetSalesRmb,
    targetYears: settings.targetYears,
    marginFloorPercent: settings.marginFloorPercent,
  });

  const [contacts, products, findings, pendingReplies, kbCount] = await Promise.all([
    prisma.contact.findMany({ include: { conversations: true } }),
    prisma.product.findMany(),
    prisma.marketFinding.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.conversation.count({ where: { status: "pending_approval" } }),
    prisma.knowledgeArticle.count(),
  ]);

  const tierCounts = Object.fromEntries(CONTACT_TIERS.map((t) => [t, 0])) as Record<string, number>;
  for (const c of contacts) tierCounts[c.tier] = (tierCounts[c.tier] ?? 0) + 1;

  const weakMargin = products.filter((p) => listMargin(p) < settings.marginFloorPercent);
  const sampleProducts = products.filter((p) => p.isSample).length;
  const aTier = tierCounts.A ?? 0;

  const criticisms: string[] = [];
  const actions: string[] = [];

  criticisms.push(
    `五年要从约 ${(settings.currentSalesRmb / 100_000_000).toFixed(2)} 亿做到 10 亿，年复合约 ${(path.cagr * 100).toFixed(1)}%。这不是「把 WhatsApp 开了就会发生」的曲线。当前系统里只有 ${contacts.length} 个客户档案、${products.length} 个 SKU、${kbCount} 条知识——以这个漏斗去撞 10 亿，是妄想。`,
  );

  if (sampleProducts / Math.max(products.length, 1) > 0.5) {
    criticisms.push(
      `产品目录里 ${sampleProducts}/${products.length} 条仍是【样本】。样本价不能当真实定价权。继续用演示价对外，会把毛利底线谈崩。`,
    );
    actions.push("用真实成本与出厂价替换样本 SKU，至少先校准 9ZT-0.6 与一个方案包。");
  }

  if (weakMargin.length) {
    criticisms.push(
      `以下 SKU 目录价毛利低于 ${settings.marginFloorPercent}%：${weakMargin.map((p) => `${p.sku}(${listMargin(p).toFixed(1)}%)`).join("、")}。它们会污染自动匹配，必须改价或下架推荐。`,
    );
    actions.push("对低毛利 SKU 提价、降本或移出自动推荐，禁止为冲量破底线。");
  }

  if (aTier === 0) {
    criticisms.push("没有 A 类客户（经销商/大单）。10 亿靠散户一单一单加，覆盖不了渠道与服务成本。");
    actions.push("在肯尼亚、尼日利亚各锁定 1 个可铺货经销商，用方案包而不是单机折扣成交。");
  }

  if (pendingReplies > 0) {
    criticisms.push(`有 ${pendingReplies} 条 WhatsApp 草稿待审核。响应慢会把线索做成竞品的。`);
    actions.push("每日清审批队列；仅在知识库强命中且毛利达标时打开自动回复。");
  }

  if (findings.filter((f) => f.status === "pending").length) {
    criticisms.push("市场情报积压未入库。回复引擎看不到当地电压/价格带，只能套话术。");
    actions.push("把已核实情报批准进知识库「市场情报」，让自动草稿引用当地配置。");
  }

  actions.push(
    `按路径数学，第 1 年销售约需 ${(path.milestones[1]?.salesRmb ?? 0) / 10_000} 万量级，且利润不得低于 ${(path.milestones[1]?.minProfitRmb ?? 0) / 10_000} 万（${settings.marginFloorPercent}%）。先定可重复的 SKU 组合与最低可报。`,
  );
  actions.push("知识库每周补 5 条真实售后/竞品问答，用 WhatsApp 实问实答反哺，而不是堆营销形容词。");

  const productTable = products
    .map((p) => {
      const lm = listMargin(p);
      const fm = floorMargin(p);
      const flag = lm < settings.marginFloorPercent ? "⚠低于底线" : "达标";
      return `| ${p.sku} | ${p.name} | ${p.category} | ${p.listPrice} | ${p.floorPrice} | ${p.cost} | ${lm.toFixed(1)}% | ${fm.toFixed(1)}% | ${flag} | ${p.isSample ? "样本" : "正式"} |`;
    })
    .join("\n");

  const contactLines = contacts
    .map(
      (c) =>
        `- ${c.name || c.phone}｜${c.country || "未知"}｜${c.tier}｜${c.stage}｜需求：${c.needs || "—"}｜会话 ${c.conversations.length}`,
    )
    .join("\n");

  const intelLines = findings
    .slice(0, 8)
    .map(
      (f) =>
        `- ${f.country}｜${f.status}｜${f.source}${f.isSample ? "｜样本" : ""}\n  配置：${f.localConfigPrefs}\n  价格：${f.priceBands}\n  竞品：${f.competitors}`,
    )
    .join("\n");

  const now = new Date();
  const periodStart = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const title = `三日经营复盘 ${now.toISOString().slice(0, 10)}`;

  const markdown = `# ${title}

> **数据声明：** 本报告只使用本系统已记录的数据。标注「样本/演示」的条目不是 GardenTec / FarmBoxer 的真实财报、成交价或市调结论。当前销售 ${settings.currentSalesRmb.toLocaleString("zh-CN")} 元、五年目标 ${settings.targetSalesRmb.toLocaleString("zh-CN")} 元是经营假设，不是已实现业绩。

## 1. 五年路径（诚实数学）

- 起点：${settings.currentSalesRmb.toLocaleString("zh-CN")} 元（0.15 亿）
- 终点：${settings.targetSalesRmb.toLocaleString("zh-CN")} 元（10 亿）
- 年限：${settings.targetYears} 年
- 倍数：${path.multiple.toFixed(2)}×
- 年复合增长率 CAGR：${(path.cagr * 100).toFixed(1)}%
- 毛利底线：${settings.marginFloorPercent}%

${path.honestNote}

| 年 | 需达到销售 | 对应最低利润 |
| --- | --- | --- |
${path.milestones
  .map(
    (m) =>
      `| Y${m.year} | ${Math.round(m.salesRmb).toLocaleString("zh-CN")} | ${Math.round(m.minProfitRmb).toLocaleString("zh-CN")} |`,
  )
  .join("\n")}

## 2. 客户分层

| 层级 | 人数 | 含义 |
| --- | --- | --- |
| A | ${tierCounts.A ?? 0} | 经销商 / 大单 |
| B | ${tierCounts.B ?? 0} | 中型牧场 |
| C | ${tierCounts.C ?? 0} | 小型养殖户 |
| D | ${tierCounts.D ?? 0} | 未定性询盘 |

${contactLines || "- （无客户记录）"}

## 3. 产品价格 / 参数 / 成本 / 类目快照

| SKU | 名称 | 类目 | 目录价 | 底价 | 成本 | 目录毛利 | 底价毛利 | 状态 | 数据 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${productTable}

## 4. 竞品与市场

${intelLines || "- 暂无情报。请先跑每日市场任务。"}

## 5. 直率批评

${criticisms.map((c) => `- ${c}`).join("\n")}

## 6. 通向 10 亿、守住 ${settings.marginFloorPercent}% 的行动

${actions.map((a, i) => `${i + 1}. ${a}`).join("\n")}
`;

  const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"/><title>${title}</title>
<style>body{font-family:ui-sans-serif,system-ui,"Noto Sans SC",sans-serif;max-width:880px;margin:32px auto;padding:0 20px;line-height:1.6;color:#142017;background:#f6f3ec} table{border-collapse:collapse;width:100%;font-size:13px} td,th{border:1px solid #d7d1c3;padding:6px 8px;text-align:left} h1,h2{color:#1f4d2b} blockquote{background:#fff7d6;border-left:4px solid #c9a227;padding:8px 12px}</style>
</head><body>${markdownToHtml(markdown)}</body></html>`;

  const report = await prisma.reviewReport.create({
    data: {
      title,
      markdown,
      html,
      periodStart,
      periodEnd: now,
      isSample: sampleProducts > 0,
    },
  });

  const run = await prisma.jobRun.create({
    data: {
      type: "review-3day",
      status: "ok",
      summary: report.title,
    },
  });

  return { report, run };
}
