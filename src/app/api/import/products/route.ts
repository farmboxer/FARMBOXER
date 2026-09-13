import { importProductsCsv } from "@/lib/csv-import";
import { fail, ok } from "@/lib/http";

export async function POST(req: Request) {
  const text = await req.text();
  try {
    const result = await importProductsCsv(text);
    return ok(result);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "导入失败");
  }
}
