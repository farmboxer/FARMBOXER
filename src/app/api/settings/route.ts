export const dynamic = "force-dynamic";

import { fail, ok, readJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { whatsappMode } from "@/lib/whatsapp";

export async function GET() {
  const settings = await getSettings();
  return ok({
    settings: {
      ...settings,
      waAccessToken: settings.waAccessToken ? "********" : "",
    },
    waMode: whatsappMode(settings.waAccessToken, settings.waPhoneNumberId),
    envHasOpenAi: Boolean(process.env.OPENAI_API_KEY),
    envHasWa: Boolean(process.env.WA_ACCESS_TOKEN && process.env.WA_PHONE_NUMBER_ID),
  });
}

export async function PUT(req: Request) {
  const body = await readJson<Record<string, unknown>>(req);
  const current = await getSettings();
  const token = body.waAccessToken;
  const item = await prisma.appSetting.update({
    where: { id: "default" },
    data: {
      companyName: (body.companyName as string) ?? current.companyName,
      currentSalesRmb:
        body.currentSalesRmb != null ? Number(body.currentSalesRmb) : current.currentSalesRmb,
      targetSalesRmb:
        body.targetSalesRmb != null ? Number(body.targetSalesRmb) : current.targetSalesRmb,
      targetYears: body.targetYears != null ? Number(body.targetYears) : current.targetYears,
      marginFloorPercent:
        body.marginFloorPercent != null
          ? Number(body.marginFloorPercent)
          : current.marginFloorPercent,
      autoReplyEnabled:
        body.autoReplyEnabled != null
          ? Boolean(body.autoReplyEnabled)
          : current.autoReplyEnabled,
      autoReplyConfidenceThreshold:
        body.autoReplyConfidenceThreshold != null
          ? Number(body.autoReplyConfidenceThreshold)
          : current.autoReplyConfidenceThreshold,
      waPhoneNumberId: (body.waPhoneNumberId as string) ?? current.waPhoneNumberId,
      waAccessToken:
        typeof token === "string" && token && token !== "********"
          ? token
          : current.waAccessToken,
      waVerifyToken: (body.waVerifyToken as string) ?? current.waVerifyToken,
      waBusinessAccountId: (body.waBusinessAccountId as string) ?? current.waBusinessAccountId,
      openaiCompatibleBaseUrl:
        (body.openaiCompatibleBaseUrl as string) ?? current.openaiCompatibleBaseUrl,
    },
  });
  if (item.marginFloorPercent < 0 || item.marginFloorPercent >= 100) {
    return fail("毛利底线需在 0–100 之间");
  }
  return ok({ settings: { ...item, waAccessToken: item.waAccessToken ? "********" : "" } });
}
