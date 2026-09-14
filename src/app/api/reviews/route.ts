export const dynamic = "force-dynamic";

import { ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const items = await prisma.reviewReport.findMany({ orderBy: { createdAt: "desc" } });
  return ok({ items });
}
