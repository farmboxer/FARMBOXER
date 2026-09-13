import { fail, ok, type IdRoute } from "@/lib/http";
import { approveFindingToKb } from "@/lib/jobs/market";

export async function POST(_req: Request, ctx: IdRoute) {
  const { id } = await ctx.params;
  try {
    const article = await approveFindingToKb(id);
    return ok({ article });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "批准失败");
  }
}
