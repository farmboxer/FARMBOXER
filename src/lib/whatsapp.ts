import { prisma } from "@/lib/prisma";

export type WhatsAppMode = "demo" | "live";

export function whatsappMode(accessToken?: string | null, phoneNumberId?: string | null): WhatsAppMode {
  const token = accessToken ?? process.env.WA_ACCESS_TOKEN ?? "";
  const phone = phoneNumberId ?? process.env.WA_PHONE_NUMBER_ID ?? "";
  return token && phone ? "live" : "demo";
}

export async function sendWhatsAppText(opts: {
  to: string;
  body: string;
  accessToken?: string;
  phoneNumberId?: string;
}): Promise<{ ok: boolean; mode: WhatsAppMode; waMessageId: string; error?: string }> {
  const token = opts.accessToken || process.env.WA_ACCESS_TOKEN || "";
  const phoneNumberId = opts.phoneNumberId || process.env.WA_PHONE_NUMBER_ID || "";
  const mode = whatsappMode(token, phoneNumberId);

  if (mode === "demo") {
    return {
      ok: true,
      mode,
      waMessageId: `demo-${Date.now()}`,
    };
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: opts.to.replace(/[^\d]/g, ""),
        type: "text",
        text: { body: opts.body, preview_url: false },
      }),
    });
    const json = (await res.json()) as {
      messages?: Array<{ id?: string }>;
      error?: { message?: string };
    };
    if (!res.ok) {
      return {
        ok: false,
        mode,
        waMessageId: "",
        error: json.error?.message || `WhatsApp API ${res.status}`,
      };
    }
    return { ok: true, mode, waMessageId: json.messages?.[0]?.id || "" };
  } catch (error) {
    return {
      ok: false,
      mode,
      waMessageId: "",
      error: error instanceof Error ? error.message : "send failed",
    };
  }
}

export type InboundPayload = {
  from: string;
  text: string;
  waMessageId?: string;
  profileName?: string;
};

export function parseWhatsAppWebhook(body: unknown): InboundPayload[] {
  const root = body as {
    entry?: Array<{
      changes?: Array<{
        value?: {
          messages?: Array<{
            id?: string;
            from?: string;
            text?: { body?: string };
            type?: string;
          }>;
          contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
        };
      }>;
    }>;
  };
  const out: InboundPayload[] = [];
  for (const entry of root.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const nameByWa = new Map(
        (value?.contacts ?? []).map((c) => [c.wa_id ?? "", c.profile?.name ?? ""]),
      );
      for (const msg of value?.messages ?? []) {
        if (!msg.from || !msg.text?.body) continue;
        out.push({
          from: msg.from,
          text: msg.text.body,
          waMessageId: msg.id,
          profileName: nameByWa.get(msg.from) || "",
        });
      }
    }
  }
  return out;
}

export async function loadEffectiveWaSettings() {
  const row = await prisma.appSetting.findUnique({ where: { id: "default" } });
  return {
    waPhoneNumberId: process.env.WA_PHONE_NUMBER_ID || row?.waPhoneNumberId || "",
    waAccessToken: process.env.WA_ACCESS_TOKEN || row?.waAccessToken || "",
    waVerifyToken: process.env.WA_VERIFY_TOKEN || row?.waVerifyToken || "farmboxer-demo-verify",
    waBusinessAccountId: process.env.WA_BUSINESS_ACCOUNT_ID || row?.waBusinessAccountId || "",
    waAppSecret: process.env.WA_APP_SECRET || row?.waAppSecret || "",
  };
}
