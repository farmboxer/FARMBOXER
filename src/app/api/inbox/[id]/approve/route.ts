import { approveAndSend } from "@/lib/inbound";
import { fail, ok, readJson, type IdRoute } from "@/lib/http";

export async function POST(req: Request, ctx: IdRoute) {
  const { id } = await ctx.params;
  const body = await readJson<{ body?: string }>(req).catch(() => ({ body: undefined }));
  try {
    const item = await approveAndSend(id, body.body);
    return ok({ item });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "发送失败");
  }
}
