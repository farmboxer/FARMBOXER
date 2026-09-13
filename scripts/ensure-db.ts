import { execSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const envFile = path.join(root, ".env");
const example = path.join(root, ".env.example");

if (!existsSync(envFile) && existsSync(example)) {
  copyFileSync(example, envFile);
  console.log("已从 .env.example 创建 .env");
}

execSync("npx prisma generate", { stdio: "inherit", cwd: root });
execSync("npx prisma db push --skip-generate", { stdio: "inherit", cwd: root });
execSync("npx tsx prisma/seed.ts --if-empty", { stdio: "inherit", cwd: root });
