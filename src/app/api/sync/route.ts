import { handleRoute, ok, readJson, requireUser } from "@/lib/http";
import { executeOperation, type SyncOperation } from "@/lib/sync";
import { recordAudit } from "@/lib/services";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser();
    const body = await readJson<{ operations?: unknown; deviceId?: unknown }>(request);
    const raw = Array.isArray(body.operations) ? body.operations : [];
    const operations: SyncOperation[] = raw
      .filter((op): op is SyncOperation => Boolean(op) && typeof op === "object")
      .slice(0, 200)
      .map((op) => ({
        id: String((op as SyncOperation).id ?? crypto.randomUUID()),
        method: String((op as SyncOperation).method ?? "POST"),
        path: String((op as SyncOperation).path ?? ""),
        body: (op as SyncOperation).body,
      }))
      .filter((op) => op.path);

    const results = [];
    for (const op of operations) {
      results.push(await executeOperation(user, op));
    }
    if (operations.length) {
      const failed = results.filter((r) => !r.ok).length;
      await recordAudit(
        user,
        "sync",
        "system",
        null,
        `${operations.length} operasi disinkronkan dari perangkat offline, ${failed} gagal`,
      );
    }
    return ok({ results, syncedAt: new Date().toISOString() });
  });
}
