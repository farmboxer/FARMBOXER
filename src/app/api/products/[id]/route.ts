import { fail, ok, readJson, type IdRoute } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request, ctx: IdRoute) {
  const { id } = await ctx.params;
  const body = await readJson<Record<string, unknown>>(req);
  try {
    const item = await prisma.product.update({
      where: { id },
      data: {
        name: body.name as string | undefined,
        sku: body.sku as string | undefined,
        category: body.category as string | undefined,
        specsJson: body.specsJson as string | undefined,
        listPrice: body.listPrice != null ? Number(body.listPrice) : undefined,
        floorPrice: body.floorPrice != null ? Number(body.floorPrice) : undefined,
        cost: body.cost != null ? Number(body.cost) : undefined,
        configsJson: body.configsJson as string | undefined,
        targetMarkets: body.targetMarkets as string | undefined,
        solutionTags: body.solutionTags as string | undefined,
        isSample: body.isSample as boolean | undefined,
      },
    });
    return ok({ item });
  } catch {
    return fail("未找到或 SKU 冲突", 400);
  }
}

export async function DELETE(_req: Request, ctx: IdRoute) {
  const { id } = await ctx.params;
  try {
    await prisma.product.delete({ where: { id } });
    return ok({ ok: true });
  } catch {
    return fail("未找到", 404);
  }
}
