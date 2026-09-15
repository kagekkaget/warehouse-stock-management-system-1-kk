import { handleRoute, intId, ok, readJson, requireUser } from "@/lib/http";
import { deleteOrder, getOrderDetail, updateOrder, type OrderInput } from "@/lib/services";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  return handleRoute(async () => {
    await requireUser("order.view");
    const { id } = await ctx.params;
    return ok(await getOrderDetail(intId(id)));
  });
}

export async function PATCH(request: Request, ctx: Ctx) {
  return handleRoute(async () => {
    const user = await requireUser("order.update");
    const { id } = await ctx.params;
    const body = await readJson<OrderInput>(request);
    const order = await updateOrder(user, intId(id), body);
    return ok({ order });
  });
}

export async function DELETE(request: Request, ctx: Ctx) {
  return handleRoute(async () => {
    const user = await requireUser("order.delete");
    const { id } = await ctx.params;
    await deleteOrder(user, intId(id));
    return ok({ ok: true });
  });
}
