import { validateOutboundBody } from "@/lib/chat-ux";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { sendWhatsAppText } from "@/lib/whatsapp";

export async function sendManualOutbound(contactId: string, rawBody: string) {
  const body = validateOutboundBody(rawBody);
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) throw new Error("找不到会话");

  const settings = await getSettings();
  const sent = await sendWhatsAppText({
    to: contact.phone,
    body,
    accessToken: settings.waAccessToken,
    phoneNumberId: settings.waPhoneNumberId,
  });

  const conversation = await prisma.conversation.create({
    data: {
      contactId: contact.id,
      waMessageId: sent.waMessageId,
      direction: "outbound",
      body,
      draftReply: body,
      status: sent.ok ? "sent" : "failed",
      autoSent: false,
    },
  });
  await prisma.contact.update({
    where: { id: contact.id },
    data: { updatedAt: new Date() },
  });

  return { conversation, mode: sent.mode, sendError: sent.error };
}

export async function discardDraft(conversationId: string) {
  const convo = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!convo || convo.status !== "pending_approval") {
    throw new Error("找不到待批准草稿");
  }
  return prisma.conversation.update({
    where: { id: conversationId },
    data: { status: "discarded" },
  });
}
