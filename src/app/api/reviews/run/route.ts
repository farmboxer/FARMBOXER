import { ok } from "@/lib/http";
import { runReviewJob } from "@/lib/jobs/review";

export async function POST() {
  const result = await runReviewJob();
  return ok(result);
}
