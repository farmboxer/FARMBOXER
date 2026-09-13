export const dynamic = "force-dynamic";

import { fail, ok, readJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const items = await prisma.marketFinding.findMany({ orderBy: { createdAt: "desc" } });
  return ok({ items });
}

export async function POST(req: Request) {
  const body = await readJson<{
    country?: string;
    localConfigPrefs?: string;
    priceBands?: string;
    competitors?: string;
    notes?: string;
  }>(req);
  if (!body.country?.trim()) return fail("国家必填");
  const item = await prisma.marketFinding.create({
    data: {
      country: body.country.trim(),
      localConfigPrefs: body.localConfigPrefs || "",
      priceBands: body.priceBands || "",
      competitors: body.competitors || "",
      notes: body.notes || "",
      source: "manual",
      status: "pending",
      isSample: false,
    },
  });
  return ok({ item }, 201);
}
