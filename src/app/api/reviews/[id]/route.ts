import { fail, type IdRoute } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, ctx: IdRoute) {
  const { id } = await ctx.params;
  const format = new URL(req.url).searchParams.get("format") || "json";
  const item = await prisma.reviewReport.findUnique({ where: { id } });
  if (!item) return fail("未找到", 404);
  if (format === "md" || format === "markdown") {
    return new Response(item.markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${item.title}.md"`,
      },
    });
  }
  if (format === "html") {
    return new Response(item.html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${item.title}.html"`,
      },
    });
  }
  return Response.json({ item });
}
