import { prisma } from "@/lib/prisma";
import { ftsMatchQuery, rankArticles, type KbHit } from "@/lib/kb-search";

export async function ensureKnowledgeFts(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
      article_id UNINDEXED,
      title,
      content,
      tags,
      category,
      tokenize = 'unicode61'
    );
  `);
}

export async function rebuildKnowledgeFts(): Promise<void> {
  await ensureKnowledgeFts();
  await prisma.$executeRawUnsafe(`DELETE FROM knowledge_fts;`);
  const articles = await prisma.knowledgeArticle.findMany();
  for (const article of articles) {
    await upsertKnowledgeFts(article.id, article.title, article.content, article.tags, article.category);
  }
}

export async function upsertKnowledgeFts(
  id: string,
  title: string,
  content: string,
  tags: string,
  category: string,
): Promise<void> {
  await ensureKnowledgeFts();
  await prisma.$executeRawUnsafe(`DELETE FROM knowledge_fts WHERE article_id = ?`, id);
  await prisma.$executeRawUnsafe(
    `INSERT INTO knowledge_fts (article_id, title, content, tags, category) VALUES (?, ?, ?, ?, ?)`,
    id,
    title,
    content,
    tags,
    category,
  );
}

export async function removeKnowledgeFts(id: string): Promise<void> {
  await ensureKnowledgeFts();
  await prisma.$executeRawUnsafe(`DELETE FROM knowledge_fts WHERE article_id = ?`, id);
}

export async function searchKnowledge(query: string, limit = 5): Promise<KbHit[]> {
  const articles = await prisma.knowledgeArticle.findMany();
  const lexical = rankArticles(articles, query, limit * 2);

  const match = ftsMatchQuery(query);
  if (!match) return lexical.slice(0, limit);

  try {
    await ensureKnowledgeFts();
    const rows = await prisma.$queryRawUnsafe<Array<{ article_id: string; rank: number }>>(
      `SELECT article_id, bm25(knowledge_fts) AS rank
       FROM knowledge_fts
       WHERE knowledge_fts MATCH ?
       ORDER BY rank
       LIMIT ?`,
      match,
      limit * 2,
    );
    const byId = new Map(articles.map((a) => [a.id, a]));
    const ftsHits: KbHit[] = [];
    for (const row of rows) {
      const article = byId.get(row.article_id);
      if (!article) continue;
      const lexicalHit = lexical.find((h) => h.id === article.id);
      ftsHits.push({
        id: article.id,
        title: article.title,
        content: article.content,
        tags: article.tags,
        category: article.category,
        language: article.language,
        source: article.source,
        isSample: article.isSample,
        score: (lexicalHit?.score ?? 1) + Math.max(0, 8 - row.rank),
      });
    }
    const merged = new Map<string, KbHit>();
    for (const hit of [...ftsHits, ...lexical]) {
      const prev = merged.get(hit.id);
      if (!prev || hit.score > prev.score) merged.set(hit.id, hit);
    }
    return [...merged.values()].sort((a, b) => b.score - a.score).slice(0, limit);
  } catch {
    return lexical.slice(0, limit);
  }
}
