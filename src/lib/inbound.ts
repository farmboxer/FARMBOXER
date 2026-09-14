import { validateOutboundBody } from "@/lib/chat-ux";
import { detectCountryFromPhone, countryLabel } from "@/lib/country";
import { searchKnowledge } from "@/lib/fts";
import { prisma } from "@/lib/prisma";
import { draftReplyFromContext, maybePolishWithLlm } from "@/lib/reply-engine";
import { getSettings } from "@/lib/settings";
import { sendWhatsAppText } from "@/lib/whatsapp";
import type { Contact } from "@prisma/client";

export async function composeDraftForContact(contact: Contact, inboundText: string) {
  const settings = await getSettings();
  const [kbHits, products] = await Promise.all([
    searchKnowledge(`${inboundText} ${contact.needs} ${contact.country}`, 5),
    prisma.product.findMany(),
  ]);
  const country = contact.country
    ? { iso2: contact.countryCode || "", nameZh: contact.country, nameEn: contact.country, dialPrefix: "" }
    : detectCountryFromPhone(contact.phone);
  const draft = draftReplyFromContext({
    inboundText,
    customerName: contact.name,
    country: countryLabel(country),
    articles: kbHits,
    products,
    settings: {
      marginFloorPercent: settings.marginFloorPercent,
      autoReplyEnabled: settings.autoReplyEnabled,
      autoReplyConfidenceThreshold: settings.autoReplyConfidenceThreshold,
    },
  });
  const polished = await maybePolishWithLlm(draft.text, inboundText);
  return {
    settings,
    draft: { ...draft, text: polished.text, usedLlm: polished.usedLlm || draft.usedLlm },
    replyText: polished.text,
  };
}

export async function ingestInbound(opts: {
  phone: string;
  text: string;
  name?: string;
  waMessageId?: string;
}) {
  const phone = opts.phone.replace(/[^\d+]/g, "");
  const country = detectCountryFromPhone(phone);
  const countryName = country?.nameZh || "";

  const contact = await prisma.contact.upsert({
    where: { phone },
    create: {
      phone,
      name: opts.name || "",
      country: countryName,
      countryCode: country?.iso2 || "",
      needs: opts.text.slice(0, 400),
      tier: "D",
      stage: "new",
    },
    update: {
      name: opts.name ? opts.name : undefined,
      country: countryName || undefined,
      countryCode: country?.iso2 || undefined,
      needs: opts.text.slice(0, 400),
    },
  });

  const inbound = await prisma.conversation.create({
    data: {
      contactId: contact.id,
      waMessageId: opts.waMessageId || "",
      direction: "inbound",
      body: opts.text,
      status: "received",
    },
  });

  const composed = await composeDraftForContact(contact, opts.text);
  const { draft, replyText } = composed;
  const usedLlm = draft.usedLlm;

  if (draft.shouldAutoSend) {
    const sent = await sendWhatsAppText({
      to: phone,
      body: replyText,
      accessToken: composed.settings.waAccessToken,
      phoneNumberId: composed.settings.waPhoneNumberId,
    });
    const outbound = await prisma.conversation.create({
      data: {
        contactId: contact.id,
        waMessageId: sent.waMessageId,
        direction: "outbound",
        body: replyText,
        status: sent.ok ? "sent" : "failed",
        draftReply: replyText,
        confidence: draft.confidence,
        autoSent: sent.ok,
        kbIdsJson: JSON.stringify(draft.kbHits.map((h) => h.id)),
        matchSkuJson: JSON.stringify(draft.productMatches.map((p) => p.sku)),
      },
    });
    await prisma.conversation.update({
      where: { id: inbound.id },
      data: {
        draftReply: replyText,
        confidence: draft.confidence,
        kbIdsJson: JSON.stringify(draft.kbHits.map((h) => h.id)),
        matchSkuJson: JSON.stringify(draft.productMatches.map((p) => p.sku)),
      },
    });
    await prisma.contact.update({
      where: { id: contact.id },
      data: {
        stage: contact.stage === "new" ? "qualified" : contact.stage,
        productNotes: draft.productMatches
          .slice(0, 3)
          .map((p) => p.sku)
          .join(", "),
      },
    });
    return {
      inbound,
      outbound,
      draft: { ...draft, text: replyText, usedLlm },
      autoSent: sent.ok,
      sendError: sent.error,
    };
  }

  const pending = await prisma.conversation.create({
    data: {
      contactId: contact.id,
      direction: "outbound",
      body: replyText,
      status: "pending_approval",
      draftReply: replyText,
      confidence: draft.confidence,
      autoSent: false,
      kbIdsJson: JSON.stringify(draft.kbHits.map((h) => h.id)),
      matchSkuJson: JSON.stringify(draft.productMatches.map((p) => p.sku)),
    },
  });
  await prisma.conversation.update({
    where: { id: inbound.id },
    data: {
      draftReply: replyText,
      confidence: draft.confidence,
      kbIdsJson: JSON.stringify(draft.kbHits.map((h) => h.id)),
      matchSkuJson: JSON.stringify(draft.productMatches.map((p) => p.sku)),
    },
  });
  await prisma.contact.update({
    where: { id: contact.id },
    data: {
      productNotes: draft.productMatches
        .slice(0, 3)
        .map((p) => p.sku)
        .join(", "),
    },
  });

  return {
    inbound,
    outbound: pending,
    draft: { ...draft, text: replyText, usedLlm },
    autoSent: false,
  };
}

export async function approveAndSend(conversationId: string, editedBody?: string) {
  const settings = await getSettings();
  const convo = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { contact: true },
  });
  if (!convo || convo.direction !== "outbound") {
    throw new Error("找不到待发送草稿");
  }
  const body = validateOutboundBody(editedBody ?? convo.draftReply ?? convo.body);

  const sent = await sendWhatsAppText({
    to: convo.contact.phone,
    body,
    accessToken: settings.waAccessToken,
    phoneNumberId: settings.waPhoneNumberId,
  });

  const item = await prisma.conversation.update({
    where: { id: convo.id },
    data: {
      body,
      draftReply: body,
      status: sent.ok ? "sent" : "failed",
      waMessageId: sent.waMessageId || convo.waMessageId,
    },
  });
  await prisma.contact.update({
    where: { id: convo.contactId },
    data: { updatedAt: new Date() },
  });
  return item;
}

export async function regenerateDraftForContact(contactId: string) {
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    include: { conversations: { orderBy: { createdAt: "desc" } } },
  });
  if (!contact) throw new Error("找不到会话");
  const lastInbound = contact.conversations.find((c) => c.direction === "inbound");
  if (!lastInbound) throw new Error("没有入站消息可生成草稿");

  const { draft, replyText } = await composeDraftForContact(contact, lastInbound.body);
  const pending = contact.conversations.find((c) => c.status === "pending_approval");
  const data = {
    body: replyText,
    draftReply: replyText,
    status: "pending_approval" as const,
    confidence: draft.confidence,
    autoSent: false,
    kbIdsJson: JSON.stringify(draft.kbHits.map((h) => h.id)),
    matchSkuJson: JSON.stringify(draft.productMatches.map((p) => p.sku)),
  };
  const outbound = pending
    ? await prisma.conversation.update({ where: { id: pending.id }, data })
    : await prisma.conversation.create({
        data: {
          contactId: contact.id,
          direction: "outbound",
          ...data,
        },
      });
  return { outbound, draft: { ...draft, text: replyText } };
}
