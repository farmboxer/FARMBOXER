import { ok } from "@/lib/http";
import { runMarketJob } from "@/lib/jobs/market";

export async function POST() {
  const result = await runMarketJob();
  return ok(result);
}
