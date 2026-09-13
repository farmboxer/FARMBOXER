import { searchKnowledge } from "@/lib/fts";
import { fail, ok } from "@/lib/http";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  if (!q.trim()) return fail("缺少 q");
  const hits = await searchKnowledge(q, 8);
  return ok({ hits });
}
