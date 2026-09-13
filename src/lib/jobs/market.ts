import { prisma } from "@/lib/prisma";
import { upsertKnowledgeFts } from "@/lib/fts";

export type MarketDraft = {
  country: string;
  localConfigPrefs: string;
  priceBands: string;
  competitors: string;
  notes?: string;
  isSample?: boolean;
};

export interface MarketAdapter {
  name: string;
  collect(countries: string[]): Promise<MarketDraft[]>;
}

const SAMPLE_INTEL: Record<string, MarketDraft> = {
  肯尼亚: {
    country: "肯尼亚",
    localConfigPrefs: "【样本】220V/50Hz 电机为主；经销商常备汽油机版应对无电牧场。铡草长度偏好 10–25mm。",
    priceBands: "【样本】9ZT-0.6 本地零售常见约 KES 25,000 档；进口到岸后渠道加价高，出厂报价须守 15% 毛利。",
    competitors: "【样本】本地组装品牌、印度 GT 系、中国杂牌 9ZT 同型号。差异化靠配件齐套与售后话术，不靠自杀价。",
    notes: "演示情报，非正式市调报告。",
    isSample: true,
  },
  尼日利亚: {
    country: "尼日利亚",
    localConfigPrefs: "【样本】电网不稳，汽油机/柴油机偏好高于纯电机。需要简单可修结构与易得刀片。",
    priceBands: "【样本】经销商要阶梯价，但任何一档不得跌破毛利底线。大单可谈方案包而非单机折扣。",
    competitors: "【样本】当地作坊焊机 + 进口二手。竞争点是一致性与安全喂入，不是最低价。",
    notes: "演示情报。",
    isSample: true,
  },
  坦桑尼亚: {
    country: "坦桑尼亚",
    localConfigPrefs: "【样本】奶牛/山羊混养，偏好鲜草 >600kg/h 的小型机。运输以港口达累斯萨拉姆分拨。",
    priceBands: "【样本】价格带接近东非邻国，配件单独报价可抬综合毛利。",
    competitors: "【样本】肯尼亚转口货与中国跨境电商低价机。",
    notes: "演示情报。",
    isSample: true,
  },
  越南: {
    country: "越南",
    localConfigPrefs: "【样本】电压 220V，潮湿环境要防锈；小型养殖与合作社并存。",
    priceBands: "【样本】本地制造挤压中低端，出口应走方案与可靠性，避免与地摊价对打。",
    competitors: "【样本】越南本地农机厂、中国跨境低价店。",
    notes: "演示情报。",
    isSample: true,
  },
};

export class SeedMarketAdapter implements MarketAdapter {
  name = "adapter:seed";
  async collect(countries: string[]): Promise<MarketDraft[]> {
    return countries
      .map((c) => SAMPLE_INTEL[c] || null)
      .filter((x): x is MarketDraft => Boolean(x));
  }
}

export class ScrapeStubAdapter implements MarketAdapter {
  name = "adapter:scrape-stub";
  async collect(countries: string[]): Promise<MarketDraft[]> {
    return countries.map((country) => ({
      country,
      localConfigPrefs: "抓取未启用：请配置合规数据源或手工录入。本条为桩实现。",
      priceBands: "未抓取。",
      competitors: "未抓取。",
      notes: "scraping optional/stubbed",
      isSample: true,
    }));
  }
}

export function defaultAdapters(): MarketAdapter[] {
  return [new SeedMarketAdapter(), new ScrapeStubAdapter()];
}

export async function runMarketJob(adapters: MarketAdapter[] = defaultAdapters()) {
  const contacts = await prisma.contact.findMany({ select: { country: true } });
  const fromWa = [...new Set(contacts.map((c) => c.country).filter(Boolean))];
  const fallback = ["肯尼亚", "尼日利亚", "坦桑尼亚", "越南"];
  const countries = fromWa.length ? fromWa : fallback;

  const created: string[] = [];
  for (const adapter of adapters) {
    const drafts = await adapter.collect(countries);
    for (const draft of drafts) {
      const existing = await prisma.marketFinding.findFirst({
        where: {
          country: draft.country,
          source: adapter.name,
          createdAt: { gte: startOfUtcDay() },
        },
      });
      if (existing) continue;
      const row = await prisma.marketFinding.create({
        data: {
          country: draft.country,
          localConfigPrefs: draft.localConfigPrefs,
          priceBands: draft.priceBands,
          competitors: draft.competitors,
          notes: draft.notes ?? "",
          source: adapter.name,
          status: "pending",
          isSample: Boolean(draft.isSample),
        },
      });
      created.push(row.id);
    }
  }

  const run = await prisma.jobRun.create({
    data: {
      type: "market-daily",
      status: "ok",
      summary: `覆盖 ${countries.join("、")}，新增 ${created.length} 条待审核情报。`,
    },
  });

  return { countries, createdCount: created.length, createdIds: created, run };
}

export async function approveFindingToKb(findingId: string) {
  const finding = await prisma.marketFinding.findUnique({ where: { id: findingId } });
  if (!finding) throw new Error("找不到情报");

  const article = await prisma.knowledgeArticle.create({
    data: {
      title: `${finding.country}市场情报（${finding.source}）`,
      content: [
        finding.isSample ? "【样本/演示情报，非正式调研】" : "【已审核市场情报】",
        `国家：${finding.country}`,
        `本地配置偏好：${finding.localConfigPrefs}`,
        `价格带：${finding.priceBands}`,
        `竞品：${finding.competitors}`,
        finding.notes ? `备注：${finding.notes}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      tags: `${finding.country},市场情报,竞品,价格带`,
      category: "市场情报",
      language: "zh-CN",
      source: `market:${finding.source}`,
      isSample: finding.isSample,
    },
  });
  await upsertKnowledgeFts(article.id, article.title, article.content, article.tags, article.category);
  await prisma.marketFinding.update({
    where: { id: finding.id },
    data: { status: "approved" },
  });
  return article;
}

function startOfUtcDay(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
