import { KB_CATEGORIES } from "@/lib/constants";
import { upsertKnowledgeFts } from "@/lib/fts";
import { prisma } from "@/lib/prisma";
import { parseCsv } from "@/lib/utils";

export async function importProductsCsv(text: string) {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error("CSV 至少需要表头和一行数据");
  const header = rows[0].map((h) => h.trim());
  const idx = (name: string) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
  const required = ["name", "sku", "category", "listPrice", "floorPrice", "cost"];
  for (const key of required) {
    if (idx(key) < 0) throw new Error(`缺少列 ${key}`);
  }
  let upserts = 0;
  for (const row of rows.slice(1)) {
    const sku = row[idx("sku")]?.trim();
    if (!sku) continue;
    await prisma.product.upsert({
      where: { sku },
      create: {
        name: row[idx("name")] ?? sku,
        sku,
        category: row[idx("category")] ?? "未分类",
        listPrice: Number(row[idx("listPrice")]) || 0,
        floorPrice: Number(row[idx("floorPrice")]) || 0,
        cost: Number(row[idx("cost")]) || 0,
        specsJson: row[idx("specsJson")] || "{}",
        configsJson: row[idx("configsJson")] || "[]",
        targetMarkets: row[idx("targetMarkets")] || "",
        solutionTags: row[idx("solutionTags")] || "",
        isSample: false,
      },
      update: {
        name: row[idx("name")] ?? sku,
        category: row[idx("category")] ?? "未分类",
        listPrice: Number(row[idx("listPrice")]) || 0,
        floorPrice: Number(row[idx("floorPrice")]) || 0,
        cost: Number(row[idx("cost")]) || 0,
        specsJson: row[idx("specsJson")] || "{}",
        configsJson: row[idx("configsJson")] || "[]",
        targetMarkets: row[idx("targetMarkets")] || "",
        solutionTags: row[idx("solutionTags")] || "",
      },
    });
    upserts += 1;
  }
  return { upserts };
}

export async function importKnowledgeCsv(text: string) {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error("CSV 至少需要表头和一行数据");
  const header = rows[0].map((h) => h.trim());
  const idx = (name: string) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
  if (idx("title") < 0 || idx("content") < 0) throw new Error("需要 title, content 列");
  let created = 0;
  for (const row of rows.slice(1)) {
    const title = row[idx("title")]?.trim();
    const content = row[idx("content")]?.trim();
    if (!title || !content) continue;
    const categoryRaw = row[idx("category")] || "方案配置";
    const category = (KB_CATEGORIES as readonly string[]).includes(categoryRaw)
      ? categoryRaw
      : "方案配置";
    const article = await prisma.knowledgeArticle.create({
      data: {
        title,
        content,
        tags: row[idx("tags")] || "",
        category,
        language: row[idx("language")] || "zh-CN",
        source: row[idx("source")] || "csv",
        isSample: false,
      },
    });
    await upsertKnowledgeFts(article.id, article.title, article.content, article.tags, article.category);
    created += 1;
  }
  return { created };
}
