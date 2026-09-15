import { getSessionUser } from "@/lib/auth";
import { handleRoute, ok } from "@/lib/http";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleRoute(async () => {
    await ensureSeeded();
    const user = await getSessionUser();
    return ok({ user });
  });
}
