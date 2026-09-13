import { execSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const envFile = path.join(root, ".env");
const example = path.join(root, ".env.example");
const dbPath = path.join(root, "prisma", "dev.db");
const force = process.argv.includes("--force");

if (!existsSync(envFile) && existsSync(example)) {
  copyFileSync(example, envFile);
  console.log("已从 .env.example 创建 .env");
}

execSync("npx prisma generate", { stdio: "inherit", cwd: root });

if (!existsSync(dbPath) || force) {
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    stdio: "inherit",
    cwd: root,
  });
  execSync("npx tsx prisma/seed.ts --if-empty", { stdio: "inherit", cwd: root });
  execSync("npx tsx scripts/rebuild-fts.ts", { stdio: "inherit", cwd: root });
} else {
  execSync("npx tsx prisma/seed.ts --if-empty", { stdio: "inherit", cwd: root });
  execSync("npx tsx scripts/rebuild-fts.ts", { stdio: "inherit", cwd: root });
}
