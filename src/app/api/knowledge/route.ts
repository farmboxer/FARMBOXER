export const dynamic = "force-dynamic";

import { KB_CATEGORIES } from "@/lib/constants";
import { upsertKnowledgeFts } from "@/lib/fts";
import { fail, ok, readJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const category = searchParams.get("category") ?? "";
  const items = await prisma.knowledgeArticle.findMany({
    where: {
      AND: [
        category ? { category } : {},
        q
          ? {
              OR: [
                { title: { contains: q } },
                { content: { contains: q } },
                { tags: { contains: q } },
              ],
            }
          : {},
      ],
    },
    orderBy: { updatedAt: "desc" },
  });
  return ok({ items, categories: KB_CATEGORIES });
}

export async function POST(req: Request) {
  const body = await readJson<{
    title?: string;
    content?: string;
    tags?: string;
    category?: string;
    language?: string;
    source?: string;
    isSample?: boolean;
  }>(req);
  if (!body.title?.trim() || !body.content?.trim()) return fail("标题和正文必填");
  const category = (KB_CATEGORIES as readonly string[]).includes(body.category ?? "")
    ? body.category!
    : "方案配置";
  const article = await prisma.knowledgeArticle.create({
    data: {
      title: body.title.trim(),
      content: body.content.trim(),
      tags: body.tags ?? "",
      category,
      language: body.language || "zh-CN",
      source: body.source || "manual",
      isSample: Boolean(body.isSample),
    },
  });
  await upsertKnowledgeFts(article.id, article.title, article.content, article.tags, article.category);
  return ok({ item: article }, 201);
}
