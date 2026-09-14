import { sendManualOutbound } from "@/lib/chat-send";
import { fail, ok, readJson, type IdRoute } from "@/lib/http";

export async function POST(req: Request, ctx: IdRoute) {
  const { id } = await ctx.params;
  const body = await readJson<{ body?: string }>(req).catch(() => ({ body: "" }));
  try {
    const result = await sendManualOutbound(id, body.body ?? "");
    return ok(result, 201);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "发送失败");
  }
}
