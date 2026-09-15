import { handleRoute, ok, readJson, requireUser } from "@/lib/http";
import { createWaste, listWaste } from "@/lib/services";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleRoute(async () => {
    await requireUser("waste.view");
    const url = new URL(request.url);
    const items = await listWaste({
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
      reason: url.searchParams.get("reason") ?? undefined,
    });
    return ok({ items, total: items.length });
  });
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser("waste.create");
    const body = await readJson<Record<string, unknown>>(request);
    const record = await createWaste(user, body);
    return ok({ record }, { status: 201 });
  });
}
