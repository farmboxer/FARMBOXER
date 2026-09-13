import { runReviewJob } from "../src/lib/jobs/review";
import { prisma } from "../src/lib/prisma";

async function main() {
  const result = await runReviewJob();
  console.log(result.report.title);
  console.log("---");
  console.log(result.report.markdown.slice(0, 800));
  console.log(`\n完整 Markdown 已写入数据库 id=${result.report.id}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
