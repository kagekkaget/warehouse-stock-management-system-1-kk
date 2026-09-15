import { desc } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { handleRoute, ok, requireUser } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleRoute(async () => {
    await requireUser("audit.view");
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? 60);
    const items = await db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
      .limit(Math.min(Number.isFinite(limit) ? limit : 60, 200));
    return ok({ items });
  });
}
