import { listMargin, meetsMarginFloor, minQuotablePrice } from "@/lib/margin";

export type ProductLike = {
  id: string;
  name: string;
  sku: string;
  category: string;
  specsJson?: string;
  listPrice: number;
  floorPrice: number;
  cost: number;
  configsJson?: string;
  targetMarkets: string;
  solutionTags: string;
};

export type MatchQuery = {
  need: string;
  country?: string;
  marginFloorPercent: number;
};

export type RankedProduct = {
  id: string;
  name: string;
  sku: string;
  category: string;
  listPrice: number;
  floorPrice: number;
  cost: number;
  marginPercent: number;
  floorMarginPercent: number;
  minQuotablePrice: number;
  meetsMarginFloor: boolean;
  score: number;
  reasons: string[];
  targetMarkets: string;
  solutionTags: string;
};

const STOP = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "need",
  "want",
  "please",
  "machine",
  "的",
  "了",
  "和",
  "及",
  "与",
  "在",
  "我",
  "要",
  "一个",
  "这个",
  "我们",
  "请问",
]);

export function extractNeedTokens(need: string): string[] {
  const lower = need.toLowerCase();
  const latin = lower.match(/[a-z0-9.+-]{2,}/g) ?? [];
  const cjkChars = [...lower].filter((ch) => /[\u4e00-\u9fff]/.test(ch));
  const compact = lower.replace(/[^\u4e00-\u9fff]/g, "");
  const grams: string[] = [];
  for (let i = 0; i < compact.length - 1; i++) grams.push(compact.slice(i, i + 2));
  return [...new Set([...latin, ...cjkChars, ...grams])].filter((t) => !STOP.has(t));
}

function haystack(product: ProductLike): string {
  return [
    product.name,
    product.sku,
    product.category,
    product.solutionTags,
    product.targetMarkets,
    product.specsJson ?? "",
    product.configsJson ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

function countryMatches(product: ProductLike, country?: string): boolean {
  if (!country) return false;
  const hay = product.targetMarkets.toLowerCase();
  return country
    .toLowerCase()
    .split(/[\/,，\s]+/)
    .filter(Boolean)
    .some((part) => hay.includes(part));
}

export function rankProducts(products: ProductLike[], query: MatchQuery): RankedProduct[] {
  const tokens = extractNeedTokens(query.need);
  const floor = query.marginFloorPercent;

  return products
    .map((product) => {
      const text = haystack(product);
      const reasons: string[] = [];
      let score = 0;

      for (const token of tokens) {
        if (product.sku.toLowerCase() === token || product.sku.toLowerCase().includes(token)) {
          score += 12;
          reasons.push(`SKU 命中 ${token}`);
        } else if (product.name.toLowerCase().includes(token)) {
          score += 6;
        } else if (product.solutionTags.toLowerCase().includes(token)) {
          score += 5;
        } else if (product.category.toLowerCase().includes(token)) {
          score += 4;
        } else if (text.includes(token)) {
          score += 2;
        }
      }

      if (countryMatches(product, query.country)) {
        score += 18;
        reasons.push(`目标市场匹配 ${query.country}`);
      }

      const listM = listMargin(product);
      const floorM = ((product.floorPrice - product.cost) / Math.max(product.floorPrice, 1)) * 100;
      const ok = meetsMarginFloor(product.listPrice, product.cost, floor);
      if (ok) {
        score += 16;
        score += Math.min(12, listM / 5);
        reasons.push(`目录价毛利 ${listM.toFixed(1)}% ≥ ${floor}%`);
      } else {
        score -= 28;
        reasons.push(`目录价毛利 ${listM.toFixed(1)}% 低于底线 ${floor}%，降权`);
      }

      if (tokens.length === 0) {
        score += ok ? 8 : 0;
      }

      if (score > 0 && reasons.length === 0) {
        reasons.push("需求关键词弱匹配");
      }

      return {
        id: product.id,
        name: product.name,
        sku: product.sku,
        category: product.category,
        listPrice: product.listPrice,
        floorPrice: product.floorPrice,
        cost: product.cost,
        marginPercent: listM,
        floorMarginPercent: floorM,
        minQuotablePrice: minQuotablePrice(product.cost, floor),
        meetsMarginFloor: ok,
        score,
        reasons,
        targetMarkets: product.targetMarkets,
        solutionTags: product.solutionTags,
      };
    })
    .sort((a, b) => b.score - a.score || b.marginPercent - a.marginPercent);
}

export function topMatches(products: ProductLike[], query: MatchQuery, limit = 3): RankedProduct[] {
  return rankProducts(products, query).slice(0, limit);
}
