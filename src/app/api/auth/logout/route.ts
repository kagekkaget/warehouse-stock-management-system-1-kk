import { getSessionUser } from "@/lib/auth";
import { handleRoute, ok } from "@/lib/http";
import { recordAudit } from "@/lib/services";

export const dynamic = "force-dynamic";

export async function POST() {
  return handleRoute(async () => {
    const user = await getSessionUser();
    if (user) await recordAudit(user, "logout", "user", user.id, "Keluar dari sistem");
    const { destroySession } = await import("@/lib/auth");
    await destroySession();
    return ok({ ok: true });
  });
}
