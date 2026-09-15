import { handleRoute, ok, readJson, requireUser } from "@/lib/http";
import { createBackup, ensureDailyBackup, listBackups } from "@/lib/backup";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleRoute(async () => {
    await requireUser("user.manage");
    await ensureDailyBackup();
    const items = await listBackups(10);
    return ok({ items });
  });
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser("user.manage");
    const body = await readJson<{ label?: unknown }>(request).catch(() => ({ label: undefined }));
    const label = String(body.label ?? "").trim() || `Cadangan manual oleh ${user.name}`;
    const id = await createBackup(user.name, label);
    return ok({ id, label }, { status: 201 });
  });
}
