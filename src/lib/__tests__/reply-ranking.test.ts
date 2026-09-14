import { describe, expect, it } from "vitest";
import { computeReplyConfidence, shouldAutoSend, buildTemplateReply } from "@/lib/reply-engine";
import { rankArticles } from "@/lib/kb-search";

const settings = {
  marginFloorPercent: 15,
  autoReplyEnabled: true,
  autoReplyConfidenceThreshold: 0.82,
};

describe("reply ranking", () => {
  it("prefers articles that mention the query terms", () => {
    const articles = [
      {
        id: "a",
        title: "无关天气",
        content: "今天下雨",
        tags: "",
        category: "售后",
        language: "zh-CN",
        source: "t",
        isSample: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "b",
        title: "【样本】9ZT-0.6 产品参数",
        content: "9ZT-0.6 铡草机 220V 肯尼亚",
        tags: "9ZT-0.6,铡草",
        category: "产品参数",
        language: "zh-CN",
        source: "t",
        isSample: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    const hits = rankArticles(articles, "肯尼亚 9ZT-0.6 铡草机", 5);
    expect(hits[0].id).toBe("b");
    expect(hits[0].score).toBeGreaterThan(hits[1]?.score ?? 0);
  });

  it("requires strong KB + margin-safe product to auto-send", () => {
    const weak = computeReplyConfidence({
      kbHits: [],
      productMatches: [],
      inboundText: "hi",
    });
    expect(weak.confidence).toBeLessThan(0.5);
    expect(shouldAutoSend(weak.confidence, settings)).toBe(false);

    const strong = computeReplyConfidence({
      kbHits: [{ score: 20 }],
      productMatches: [{ score: 30, meetsMarginFloor: true }],
      inboundText: "Need 9ZT-0.6 chaff cutter 220V for dairy farm in Kenya please",
    });
    expect(strong.confidence).toBeGreaterThanOrEqual(0.82);
    expect(shouldAutoSend(strong.confidence, settings)).toBe(true);
    expect(shouldAutoSend(strong.confidence, { ...settings, autoReplyEnabled: false })).toBe(false);
  });

  it("template reply never recommends selling below margin floor", () => {
    const text = buildTemplateReply({
      inboundText: "Need cheapest chaff cutter",
      country: "肯尼亚",
      kbHits: [],
      productMatches: [
        {
          id: "x",
          name: "低毛利",
          sku: "LOW",
          category: "铡草机",
          listPrice: 800,
          floorPrice: 760,
          cost: 750,
          marginPercent: 6,
          floorMarginPercent: 1,
          minQuotablePrice: 882,
          meetsMarginFloor: false,
          score: 1,
          reasons: ["低于底线"],
          targetMarkets: "",
          solutionTags: "",
        },
      ],
      marginFloorPercent: 15,
    });
    expect(text).toMatch(/15%/);
    expect(text).not.toMatch(/LOW/);
  });
});
