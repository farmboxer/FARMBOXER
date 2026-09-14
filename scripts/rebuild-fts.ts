import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
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
  await prisma.$executeRawUnsafe(`DELETE FROM knowledge_fts;`);
  const articles = await prisma.knowledgeArticle.findMany();
  for (const article of articles) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO knowledge_fts (article_id, title, content, tags, category) VALUES (?, ?, ?, ?, ?)`,
      article.id,
      article.title,
      article.content,
      article.tags,
      article.category,
    );
  }
  console.log(`FTS 已重建，${articles.length} 条。`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
