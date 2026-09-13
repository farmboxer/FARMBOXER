import { prisma } from "@/lib/prisma";
import { DEFAULT_MARGIN_FLOOR } from "@/lib/constants";

export async function getSettings() {
  const existing = await prisma.appSetting.findUnique({ where: { id: "default" } });
  if (existing) {
    const envFloor = Number(process.env.MARGIN_FLOOR_PERCENT);
    return {
      ...existing,
      marginFloorPercent:
        Number.isFinite(envFloor) && envFloor > 0 ? envFloor : existing.marginFloorPercent,
    };
  }
  return prisma.appSetting.create({
    data: {
      id: "default",
      marginFloorPercent: Number(process.env.MARGIN_FLOOR_PERCENT) || DEFAULT_MARGIN_FLOOR,
    },
  });
}
