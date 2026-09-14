export const dynamic = "force-dynamic";

import { fail, ok, readJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const items = await prisma.product.findMany({ orderBy: { updatedAt: "desc" } });
  return ok({ items });
}

export async function POST(req: Request) {
  const body = await readJson<{
    name?: string;
    sku?: string;
    category?: string;
    specsJson?: string;
    listPrice?: number;
    floorPrice?: number;
    cost?: number;
    configsJson?: string;
    targetMarkets?: string;
    solutionTags?: string;
    isSample?: boolean;
  }>(req);
  if (!body.name?.trim() || !body.sku?.trim()) return fail("名称和 SKU 必填");
  const item = await prisma.product.create({
    data: {
      name: body.name.trim(),
      sku: body.sku.trim(),
      category: body.category || "未分类",
      specsJson: body.specsJson || "{}",
      listPrice: Number(body.listPrice) || 0,
      floorPrice: Number(body.floorPrice) || 0,
      cost: Number(body.cost) || 0,
      configsJson: body.configsJson || "[]",
      targetMarkets: body.targetMarkets || "",
      solutionTags: body.solutionTags || "",
      isSample: Boolean(body.isSample),
    },
  });
  return ok({ item }, 201);
}
