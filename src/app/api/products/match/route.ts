import { fail, ok, readJson } from "@/lib/http";
import { rankProducts } from "@/lib/matcher";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";

export async function POST(req: Request) {
  const body = await readJson<{ need?: string; country?: string }>(req);
  if (!body.need?.trim()) return fail("请提供客户需求 need");
  const settings = await getSettings();
  const products = await prisma.product.findMany();
  const ranked = rankProducts(products, {
    need: body.need,
    country: body.country,
    marginFloorPercent: settings.marginFloorPercent,
  });
  return ok({
    marginFloorPercent: settings.marginFloorPercent,
    ranked,
    note: "排序偏好毛利达标机型；低于底线的 SKU 会被降权，不会作为自动报价首选。",
  });
}
