import { fail, ok, type IdRoute } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { parseJson } from "@/lib/utils";

export async function GET(_req: Request, ctx: IdRoute) {
  const { id } = await ctx.params;
  const contact = await prisma.contact.findUnique({
    where: { id },
    include: { conversations: { orderBy: { createdAt: "asc" } } },
  });
  if (!contact) return fail("找不到会话", 404);

  const unreadIds = contact.conversations
    .filter((c) => c.direction === "inbound" && c.status === "received")
    .map((c) => c.id);
  if (unreadIds.length) {
    await prisma.conversation.updateMany({
      where: { id: { in: unreadIds } },
      data: { status: "read" },
    });
  }

  const conversations = contact.conversations.map((c) =>
    unreadIds.includes(c.id) ? { ...c, status: "read" } : c,
  );
  const visible = conversations.filter((c) => c.status !== "discarded");
  const hintSource =
    [...visible].reverse().find((c) => c.status === "pending_approval") ||
    [...visible].reverse().find((c) => c.direction === "outbound" && c.kbIdsJson !== "[]");

  const kbIds = parseJson<string[]>(hintSource?.kbIdsJson ?? "[]", []);
  const skus = parseJson<string[]>(hintSource?.matchSkuJson ?? "[]", []);
  const [kbHits, products] = await Promise.all([
    kbIds.length
      ? prisma.knowledgeArticle.findMany({ where: { id: { in: kbIds } } })
      : Promise.resolve([]),
    skus.length ? prisma.product.findMany({ where: { sku: { in: skus } } }) : Promise.resolve([]),
  ]);

  return ok({
    contact: { ...contact, conversations: visible },
    hints: { kbHits, products },
  });
}
