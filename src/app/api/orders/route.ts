import { handleRoute, ok, readJson, requireUser } from "@/lib/http";
import { createOrder, listOrderItems, listOrders, type OrderInput } from "@/lib/services";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleRoute(async () => {
    await requireUser("order.view");
    const url = new URL(request.url);
    const items = await listOrders({
      search: url.searchParams.get("search") ?? undefined,
      paymentStatus: url.searchParams.get("paymentStatus") ?? undefined,
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
    });
    const detail = await listOrderItems(items.map((o) => o.id));
    return ok({ items, orderItems: detail, total: items.length });
  });
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser("order.create");
    const body = await readJson<OrderInput>(request);
    const order = await createOrder(user, body);
    return ok({ order }, { status: 201 });
  });
}
