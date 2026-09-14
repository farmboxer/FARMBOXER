export const dynamic = "force-dynamic";

import { computeGoalPath } from "@/lib/goals";
import { listMargin } from "@/lib/margin";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { whatsappMode } from "@/lib/whatsapp";
import { ok } from "@/lib/http";

export async function GET() {
  const settings = await getSettings();
  const path = computeGoalPath({
    currentSalesRmb: settings.currentSalesRmb,
    targetSalesRmb: settings.targetSalesRmb,
    targetYears: settings.targetYears,
    marginFloorPercent: settings.marginFloorPercent,
  });

  const [contacts, products, kb, pending, sentToday, findings, lastReview, jobs] = await Promise.all([
    prisma.contact.count(),
    prisma.product.findMany(),
    prisma.knowledgeArticle.count(),
    prisma.conversation.count({ where: { status: "pending_approval" } }),
    prisma.conversation.count({
      where: {
        status: "sent",
        createdAt: { gte: new Date(new Date().toISOString().slice(0, 10)) },
      },
    }),
    prisma.marketFinding.count({ where: { status: "pending" } }),
    prisma.reviewReport.findFirst({ orderBy: { createdAt: "desc" } }),
    prisma.jobRun.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

  const weak = products.filter((p) => listMargin(p) < settings.marginFloorPercent);
  const sampleProducts = products.filter((p) => p.isSample).length;
  const alerts: Array<{ level: "warn" | "info"; text: string }> = [
    {
      level: "info",
      text: "看板数字来自本库记录与目标假设，不是已审计的公司业绩。",
    },
  ];
  if (weak.length) {
    alerts.push({
      level: "warn",
      text: `${weak.length} 个 SKU 目录价毛利低于 ${settings.marginFloorPercent}%：${weak.map((p) => p.sku).join("、")}`,
    });
  }
  if (pending) alerts.push({ level: "warn", text: `${pending} 条聊天草稿待在会话中批准发送` });
  if (findings) alerts.push({ level: "warn", text: `${findings} 条市场情报待批准入库` });
  if (sampleProducts) {
    alerts.push({ level: "info", text: `${sampleProducts} 条产品仍为样本目录` });
  }

  return ok({
    settings,
    path,
    stats: {
      contacts,
      products: products.length,
      knowledge: kb,
      pendingApprovals: pending,
      sentToday,
      pendingFindings: findings,
    },
    alerts,
    lastReview,
    jobs,
    waMode: whatsappMode(settings.waAccessToken, settings.waPhoneNumberId),
    dataHonesty: "seed_or_recorded_only",
  });
}
