export const dynamic = "force-dynamic";

import { ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const contacts = await prisma.contact.findMany({
    include: {
      conversations: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });
  const pending = await prisma.conversation.findMany({
    where: { status: "pending_approval" },
    include: { contact: true },
    orderBy: { createdAt: "desc" },
  });
  return ok({ contacts, pending });
}
