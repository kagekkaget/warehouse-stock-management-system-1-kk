import { handleRoute, ok, readJson, requireUser } from "@/lib/http";
import { createMovement, listMovements } from "@/lib/services";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleRoute(async () => {
    await requireUser("movement.view");
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? 100);
    const productIdRaw = url.searchParams.get("productId");
    const items = await listMovements(
      Number.isFinite(limit) ? limit : 100,
      productIdRaw ? Number(productIdRaw) : undefined,
    );
    return ok({ items });
  });
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser("movement.create");
    const body = await readJson<Record<string, unknown>>(request);
    const result = await createMovement(user, body);
    return ok(result, { status: 201 });
  });
}
