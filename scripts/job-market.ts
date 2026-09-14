import { runMarketJob } from "../src/lib/jobs/market";
import { prisma } from "../src/lib/prisma";

async function main() {
  const result = await runMarketJob();
  console.log(JSON.stringify(result, null, 2));
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
