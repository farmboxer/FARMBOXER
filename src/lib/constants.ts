export const KB_CATEGORIES = [
  "产品参数",
  "报价话术",
  "售后",
  "竞品",
  "市场情报",
  "方案配置",
] as const;

export type KbCategory = (typeof KB_CATEGORIES)[number];

export const CONTACT_TIERS = ["A", "B", "C", "D"] as const;
export const CONTACT_STAGES = [
  "new",
  "qualified",
  "quoted",
  "negotiating",
  "won",
  "lost",
] as const;

export const STAGE_LABELS: Record<string, string> = {
  new: "新线索",
  qualified: "已定性",
  quoted: "已报价",
  negotiating: "洽谈中",
  won: "成交",
  lost: "流失",
};

export const PRODUCT_CATEGORIES = [
  "铡草机",
  "揉丝机",
  "粉碎机",
  "方案包",
  "配件",
] as const;

export const SAMPLE_DISCLAIMER =
  "演示/样本数据，非正式财报或真实成交价。报价须遵守毛利底线。";

export const DEFAULT_MARGIN_FLOOR = 15;
export const DEFAULT_CURRENT_SALES = 15_000_000;
export const DEFAULT_TARGET_SALES = 1_000_000_000;
export const DEFAULT_TARGET_YEARS = 5;
