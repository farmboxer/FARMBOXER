import { KB_CATEGORIES } from "@/lib/constants";
import { removeKnowledgeFts, upsertKnowledgeFts } from "@/lib/fts";
import { fail, ok, readJson, type IdRoute } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, ctx: IdRoute) {
  const { id } = await ctx.params;
  const item = await prisma.knowledgeArticle.findUnique({ where: { id } });
  if (!item) return fail("未找到", 404);
  return ok({ item });
}

export async function PUT(req: Request, ctx: IdRoute) {
  const { id } = await ctx.params;
  const body = await readJson<{
    title?: string;
    content?: string;
    tags?: string;
    category?: string;
    language?: string;
    source?: string;
    isSample?: boolean;
  }>(req);
  const category =
    body.category && (KB_CATEGORIES as readonly string[]).includes(body.category)
      ? body.category
      : undefined;
  try {
    const item = await prisma.knowledgeArticle.update({
      where: { id },
      data: {
        title: body.title,
        content: body.content,
        tags: body.tags,
        category,
        language: body.language,
        source: body.source,
        isSample: body.isSample,
      },
    });
    await upsertKnowledgeFts(item.id, item.title, item.content, item.tags, item.category);
    return ok({ item });
  } catch {
    return fail("未找到", 404);
  }
}

export async function DELETE(_req: Request, ctx: IdRoute) {
  const { id } = await ctx.params;
  try {
    await prisma.knowledgeArticle.delete({ where: { id } });
    await removeKnowledgeFts(id);
    return ok({ ok: true });
  } catch {
    return fail("未找到", 404);
  }
}
