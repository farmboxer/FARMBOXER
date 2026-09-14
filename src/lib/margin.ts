export type PricedItem = {
  listPrice: number;
  floorPrice: number;
  cost: number;
};

export function marginPercent(price: number, cost: number): number {
  if (!Number.isFinite(price) || price <= 0) return 0;
  return ((price - cost) / price) * 100;
}

export function listMargin(item: PricedItem): number {
  return marginPercent(item.listPrice, item.cost);
}

export function floorMargin(item: PricedItem): number {
  return marginPercent(item.floorPrice, item.cost);
}

export function meetsMarginFloor(price: number, cost: number, floorPercent: number): boolean {
  return marginPercent(price, cost) + 1e-9 >= floorPercent;
}

/** 不低于成本且满足毛利底线的最低可报价格 */
export function minQuotablePrice(cost: number, floorPercent: number): number {
  if (floorPercent >= 100) return Number.POSITIVE_INFINITY;
  return cost / (1 - floorPercent / 100);
}

export function recommendQuotePrice(item: PricedItem, floorPercent: number): {
  price: number;
  marginPercent: number;
  clampedToFloor: boolean;
} {
  const minPrice = minQuotablePrice(item.cost, floorPercent);
  const price = Math.max(item.listPrice, minPrice);
  return {
    price,
    marginPercent: marginPercent(price, item.cost),
    clampedToFloor: item.listPrice < minPrice,
  };
}

export function assertQuoteRespectsMargin(
  price: number,
  cost: number,
  floorPercent: number,
): { ok: boolean; reason?: string } {
  if (price < cost) {
    return { ok: false, reason: "报价低于成本，禁止。" };
  }
  if (!meetsMarginFloor(price, cost, floorPercent)) {
    return {
      ok: false,
      reason: `报价毛利 ${marginPercent(price, cost).toFixed(1)}% 低于底线 ${floorPercent}%。`,
    };
  }
  return { ok: true };
}
