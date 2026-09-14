import { fail, ok, readJson } from "@/lib/http";
import { ingestInbound } from "@/lib/inbound";

export async function POST(req: Request) {
  const body = await readJson<{ phone?: string; name?: string; text?: string }>(req);
  if (!body.phone?.trim() || !body.text?.trim()) return fail("phone 与 text 必填");
  const result = await ingestInbound({
    phone: body.phone,
    name: body.name,
    text: body.text,
    waMessageId: `mock-${Date.now()}`,
  });
  return ok({
    ...result,
    hint: "此为 MOCK 注入。若刚新增知识库条目，草稿应能引用相关命中。",
  });
}
