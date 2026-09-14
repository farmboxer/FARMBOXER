import type { KnowledgeArticle } from "@prisma/client";

export type KbHit = {
  id: string;
  title: string;
  content: string;
  tags: string;
  category: string;
  language: string;
  source: string;
  isSample: boolean;
  score: number;
};

const STOP = new Set(["the", "and", "for", "with", "please", "的", "了", "和", "在", "我", "要"]);

export function kbTokens(query: string): string[] {
  const lower = query.toLowerCase();
  const latin = lower.match(/[a-z0-9.+-]{2,}/g) ?? [];
  const compact = lower.replace(/[^\u4e00-\u9fff]/g, "");
  const grams: string[] = [];
  for (let i = 0; i < compact.length - 1; i++) grams.push(compact.slice(i, i + 2));
  if (compact.length === 1) grams.push(compact);
  return [...new Set([...latin, ...grams])].filter((t) => !STOP.has(t));
}

export function scoreArticle(article: Pick<KnowledgeArticle, "title" | "content" | "tags" | "category">, query: string): number {
  const tokens = kbTokens(query);
  if (tokens.length === 0) return 0;
  const title = article.title.toLowerCase();
  const content = article.content.toLowerCase();
  const tags = article.tags.toLowerCase();
  const category = article.category.toLowerCase();
  let score = 0;
  for (const token of tokens) {
    if (title.includes(token)) score += 8;
    if (tags.includes(token)) score += 5;
    if (category.includes(token)) score += 3;
    if (content.includes(token)) score += 2;
  }
  return score;
}

export function rankArticles(
  articles: KnowledgeArticle[],
  query: string,
  limit = 5,
): KbHit[] {
  return articles
    .map((article) => ({
      id: article.id,
      title: article.title,
      content: article.content,
      tags: article.tags,
      category: article.category,
      language: article.language,
      source: article.source,
      isSample: article.isSample,
      score: scoreArticle(article, query),
    }))
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function ftsMatchQuery(query: string): string | null {
  const tokens = kbTokens(query).filter((t) => t.length >= 2);
  if (tokens.length === 0) return null;
  return tokens.map((t) => `"${t.replace(/"/g, "")}"`).join(" OR ");
}
