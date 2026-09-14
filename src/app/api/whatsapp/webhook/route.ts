import { ingestInbound } from "@/lib/inbound";
import { parseWhatsAppWebhook } from "@/lib/whatsapp";
import { getSettings } from "@/lib/settings";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const settings = await getSettings();
  if (mode === "subscribe" && token === settings.waVerifyToken && challenge) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

export async function POST(req: Request) {
  const body = await req.json();
  const messages = parseWhatsAppWebhook(body);
  const results = [];
  for (const msg of messages) {
    results.push(
      await ingestInbound({
        phone: msg.from,
        text: msg.text,
        name: msg.profileName,
        waMessageId: msg.waMessageId,
      }),
    );
  }
  return Response.json({ received: messages.length, results: results.length });
}
