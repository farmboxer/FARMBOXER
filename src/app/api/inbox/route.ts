export const dynamic = "force-dynamic";

import { conversationPreview } from "@/lib/chat-ux";
import { ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const contacts = await prisma.contact.findMany({
    include: {
      conversations: { orderBy: { createdAt: "desc" } },
    },
  });

  const items = contacts
    .map((contact) => {
      const visible = contact.conversations.filter((c) => c.status !== "discarded");
      const last = visible[0] ?? null;
      const unreadCount = contact.conversations.filter(
        (c) => c.direction === "inbound" && c.status === "received",
      ).length;
      const pendingDraft = visible.some((c) => c.status === "pending_approval");
      return {
        id: contact.id,
        phone: contact.phone,
        name: contact.name,
        country: contact.country,
        countryCode: contact.countryCode,
        needs: contact.needs,
        tier: contact.tier,
        stage: contact.stage,
        productNotes: contact.productNotes,
        lastMessage: last
          ? {
              id: last.id,
              body: last.body,
              direction: last.direction,
              status: last.status,
              createdAt: last.createdAt,
            }
          : null,
        lastPreview: conversationPreview(last),
        lastAt: last?.createdAt ?? contact.updatedAt,
        unreadCount,
        pendingDraft,
      };
    })
    .sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());

  return ok({
    contacts: items,
    pendingCount: items.filter((c) => c.pendingDraft).length,
  });
}
