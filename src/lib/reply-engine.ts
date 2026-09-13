import { rankArticles, type KbHit } from "@/lib/kb-search";
import { rankProducts, type ProductLike, type RankedProduct } from "@/lib/matcher";
import { formatRmb } from "@/lib/utils";

export type ReplySettings = {
  marginFloorPercent: number;
  autoReplyEnabled: boolean;
  autoReplyConfidenceThreshold: number;
};

export type ReplyDraftInput = {
  inboundText: string;
  customerName?: string;
  country?: string;
  languageHint?: string;
  articles: KbHit[] | Parameters<typeof rankArticles>[0];
  products: ProductLike[];
  settings: ReplySettings;
};

export type ReplyDraft = {
  text: string;
  confidence: number;
  reasons: string[];
  kbHits: KbHit[];
  productMatches: RankedProduct[];
  shouldAutoSend: boolean;
  usedLlm: boolean;
};

export function looksEnglish(text: string): boolean {
  const letters = (text.match(/[A-Za-z]/g) ?? []).length;
  const cjk = (text.match(/[\u4e00-\u9fff]/g) ?? []).length;
  return letters >= 12 && letters > cjk * 2;
}

export function computeReplyConfidence(opts: {
  kbHits: Array<{ score: number }>;
  productMatches: Array<{ score: number; meetsMarginFloor: boolean }>;
  inboundText: string;
}): { confidence: number; reasons: string[] } {
  const reasons: string[] = [];
  let confidence = 0.18;

  const topKb = opts.kbHits[0];
  if (topKb && topKb.score >= 16) {
    confidence += 0.38;
    reasons.push("知识库强命中");
  } else if (topKb && topKb.score >= 8) {
    confidence += 0.24;
    reasons.push("知识库中等命中");
  } else if (topKb) {
    confidence += 0.1;
    reasons.push("知识库弱命中");
  } else {
    reasons.push("知识库未命中，需人工");
  }

  const topProduct = opts.productMatches[0];
  if (topProduct && topProduct.score >= 20 && topProduct.meetsMarginFloor) {
    confidence += 0.28;
    reasons.push("产品匹配且毛利达标");
  } else if (topProduct && topProduct.meetsMarginFloor) {
    confidence += 0.16;
    reasons.push("有可报产品");
  } else if (topProduct) {
    confidence += 0.04;
    reasons.push("匹配产品毛利不足，不得自动报价");
  }

  if (opts.inboundText.trim().length >= 20) {
    confidence += 0.06;
  }

  return { confidence: Math.max(0, Math.min(0.97, confidence)), reasons };
}

export function shouldAutoSend(confidence: number, settings: ReplySettings): boolean {
  return settings.autoReplyEnabled && confidence >= settings.autoReplyConfidenceThreshold;
}

function excerpt(content: string, max = 220): string {
  const compact = content.replace(/\s+/g, " ").trim();
  return compact.length > max ? `${compact.slice(0, max)}…` : compact;
}

export function buildTemplateReply(input: {
  inboundText: string;
  customerName?: string;
  country?: string;
  kbHits: KbHit[];
  productMatches: RankedProduct[];
  marginFloorPercent: number;
}): string {
  const en = looksEnglish(input.inboundText);
  const name = input.customerName || (en ? "there" : "您好");
  const country = input.country || (en ? "your market" : "贵国市场");
  const quoteable = input.productMatches.filter((p) => p.meetsMarginFloor).slice(0, 2);
  const kb = input.kbHits[0];

  if (en) {
    const productLines = quoteable.length
      ? quoteable
          .map(
            (p) =>
              `- ${p.name} (${p.sku}): list ${formatRmb(p.listPrice)} FOB-style demo list, min quotable ${formatRmb(p.minQuotablePrice)} to keep ≥${input.marginFloorPercent}% margin. ${p.reasons[0] ?? ""}`,
          )
          .join("\n")
      : "- I will have a colleague confirm a margin-safe configuration before quoting.";
    const kbLine = kb
      ? `From our knowledge base (${kb.category}${kb.isSample ? ", sample" : ""}): ${excerpt(kb.content)}`
      : "I do not have a high-confidence knowledge hit yet, so a human will review.";
    return `Hi ${name}, thanks for messaging FarmBoxer / GardenTec.\n\nWe noted your need for ${country}: "${input.inboundText.trim().slice(0, 180)}".\n\n${kbLine}\n\nRecommended options (demo catalog; not a live offer):\n${productLines}\n\nAll prices must keep gross margin ≥ ${input.marginFloorPercent}%. If you share voltage, herd size and whether you prefer electric or petrol, we can lock a configuration.\n\n— FarmBoxer WhatsApp desk`;
  }

  const productLines = quoteable.length
    ? quoteable
        .map(
          (p) =>
            `- ${p.name}（${p.sku}）：目录价 ${formatRmb(p.listPrice)}，守住 ${input.marginFloorPercent}% 毛利的最低可报价 ${formatRmb(p.minQuotablePrice)}。${p.reasons[0] ?? ""}`,
        )
        .join("\n")
    : "- 暂无同时满足需求与毛利底线的自动推荐，将转人工核算后再报价。";
  const kbLine = kb
    ? `知识库参考【${kb.category} / ${kb.title}】${kb.isSample ? "（样本）" : ""}：${excerpt(kb.content)}`
    : "知识库尚未形成高置信命中，本条将进入人工审核。";

  return `${name}，感谢联系 GardenTec / FarmBoxer。\n\n我们理解您在${country}的需求：「${input.inboundText.trim().slice(0, 180)}」。\n\n${kbLine}\n\n建议机型（演示目录，非正式成交价）：\n${productLines}\n\n所有报价必须满足毛利 ≥ ${input.marginFloorPercent}%，不会为了冲量亏本出货。请补充电压、养殖规模、电机/汽油机偏好，我们据此确认配置。\n\n—— FarmBoxer WhatsApp 经营中台`;
}

export function draftReplyFromContext(input: ReplyDraftInput): ReplyDraft {
  const kbHits: KbHit[] = Array.isArray(input.articles) && input.articles[0] && "score" in input.articles[0]
    ? (input.articles as KbHit[])
    : rankArticles(input.articles as Parameters<typeof rankArticles>[0], input.inboundText, 5);

  const productMatches = rankProducts(input.products, {
    need: input.inboundText,
    country: input.country,
    marginFloorPercent: input.settings.marginFloorPercent,
  }).slice(0, 5);

  const { confidence, reasons } = computeReplyConfidence({
    kbHits,
    productMatches,
    inboundText: input.inboundText,
  });

  const text = buildTemplateReply({
    inboundText: input.inboundText,
    customerName: input.customerName,
    country: input.country,
    kbHits,
    productMatches,
    marginFloorPercent: input.settings.marginFloorPercent,
  });

  return {
    text,
    confidence,
    reasons,
    kbHits,
    productMatches,
    shouldAutoSend: shouldAutoSend(confidence, input.settings),
    usedLlm: false,
  };
}

export async function maybePolishWithLlm(draft: string, inbound: string): Promise<{ text: string; usedLlm: boolean }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { text: draft, usedLlm: false };

  const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content:
              "You are FarmBoxer / GardenTec WhatsApp sales ops. Polish the draft. Keep facts, SKUs, prices, and the ≥15% margin rule. Do not invent discounts below the given min quotable price. Keep the same language as the draft. Be concise.",
          },
          {
            role: "user",
            content: `Customer inbound:\n${inbound}\n\nDraft to polish:\n${draft}`,
          },
        ],
      }),
    });
    if (!res.ok) return { text: draft, usedLlm: false };
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) return { text: draft, usedLlm: false };
    return { text, usedLlm: true };
  } catch {
    return { text: draft, usedLlm: false };
  }
}
