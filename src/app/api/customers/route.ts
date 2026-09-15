import { handleRoute, ok, readJson, requireUser } from "@/lib/http";
import { createCustomer, listCustomers, type CustomerInput } from "@/lib/services";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleRoute(async () => {
    await requireUser("customer.view");
    const url = new URL(request.url);
    const items = await listCustomers(url.searchParams.get("search") ?? undefined);
    return ok({ items, total: items.length });
  });
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser("customer.create");
    const body = await readJson<CustomerInput>(request);
    const customer = await createCustomer(user, body);
    return ok({ customer }, { status: 201 });
  });
}
