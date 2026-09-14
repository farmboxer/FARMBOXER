import { discardDraft } from "@/lib/chat-send";
import { fail, ok, type IdRoute } from "@/lib/http";

export async function POST(_req: Request, ctx: IdRoute) {
  const { id } = await ctx.params;
  try {
    const item = await discardDraft(id);
    return ok({ item });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "丢弃失败");
  }
}
