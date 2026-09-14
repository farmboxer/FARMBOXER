import { fail, ok, type IdRoute } from "@/lib/http";
import { regenerateDraftForContact } from "@/lib/inbound";

export async function POST(_req: Request, ctx: IdRoute) {
  const { id } = await ctx.params;
  try {
    const result = await regenerateDraftForContact(id);
    return ok(result);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "生成失败");
  }
}
