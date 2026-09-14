import { describe, expect, it } from "vitest";
import { rankProducts, extractNeedTokens } from "@/lib/matcher";

const floor = 15;

const catalog = [
  {
    id: "1",
    name: "FarmBoxer 9ZT-0.6 铡草机",
    sku: "FB-9ZT-0.6",
    category: "铡草机",
    listPrice: 1280,
    floorPrice: 980,
    cost: 720,
    targetMarkets: "肯尼亚,尼日利亚",
    solutionTags: "铡草,chaff cutter,奶牛",
  },
  {
    id: "2",
    name: "亏损演示机",
    sku: "FB-DEMO-LOWMARGIN",
    category: "铡草机",
    listPrice: 800,
    floorPrice: 760,
    cost: 750,
    targetMarkets: "肯尼亚",
    solutionTags: "铡草,低价",
  },
  {
    id: "3",
    name: "饲料粉碎机",
    sku: "FB-9FQ-50",
    category: "粉碎机",
    listPrice: 1560,
    floorPrice: 1180,
    cost: 860,
    targetMarkets: "越南",
    solutionTags: "粉碎,玉米",
  },
];

describe("product matcher", () => {
  it("extracts latin and CJK tokens", () => {
    const tokens = extractNeedTokens("Need 9ZT-0.6 铡草机 in Kenya");
    expect(tokens.some((t) => t.includes("9zt") || t.includes("9zt-0.6"))).toBe(true);
    expect(tokens.some((t) => t.includes("铡草"))).toBe(true);
  });

  it("ranks margin-safe chaff cutter above low-margin sibling for Kenya dairy", () => {
    const ranked = rankProducts(catalog, {
      need: "9ZT-0.6 chaff cutter dairy Kenya 220V",
      country: "肯尼亚",
      marginFloorPercent: floor,
    });
    expect(ranked[0].sku).toBe("FB-9ZT-0.6");
    expect(ranked[0].meetsMarginFloor).toBe(true);
    const low = ranked.find((r) => r.sku === "FB-DEMO-LOWMARGIN");
    expect(low).toBeTruthy();
    expect(low!.meetsMarginFloor).toBe(false);
    expect(low!.score).toBeLessThan(ranked[0].score);
  });

  it("still returns low-margin items but demotes them", () => {
    const ranked = rankProducts(catalog, {
      need: "铡草机 肯尼亚",
      country: "肯尼亚",
      marginFloorPercent: floor,
    });
    const low = ranked.find((r) => r.sku === "FB-DEMO-LOWMARGIN")!;
    expect(low.reasons.some((r) => r.includes("低于底线"))).toBe(true);
  });
});
