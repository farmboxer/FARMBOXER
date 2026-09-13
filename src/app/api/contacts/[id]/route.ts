import { fail, ok, readJson, type IdRoute } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request, ctx: IdRoute) {
  const { id } = await ctx.params;
  const body = await readJson<{
    name?: string;
    country?: string;
    needs?: string;
    tier?: string;
    stage?: string;
    productNotes?: string;
  }>(req);
  try {
    const item = await prisma.contact.update({
      where: { id },
      data: {
        name: body.name,
        country: body.country,
        needs: body.needs,
        tier: body.tier,
        stage: body.stage,
        productNotes: body.productNotes,
      },
    });
    return ok({ item });
  } catch {
    return fail("未找到", 404);
  }
}
