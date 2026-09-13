import { ok, type IdRoute } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, ctx: IdRoute) {
  const { id } = await ctx.params;
  const contact = await prisma.contact.findUnique({
    where: { id },
    include: { conversations: { orderBy: { createdAt: "asc" } } },
  });
  return ok({ contact });
}
