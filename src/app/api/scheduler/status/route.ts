// Knight FM — Scheduler status (D-002): in-process lock + last run timestamp.

import { ok } from "@/lib/api";
import { schedulerStatus } from "@/lib/engine/scheduler";

export async function GET() {
  return ok(schedulerStatus());
}
