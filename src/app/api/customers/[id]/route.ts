import { handleRoute, intId, ok, readJson, requireUser } from "@/lib/http";
import { deleteCustomer, getCustomerDetail, updateCustomer, type CustomerInput } from "@/lib/services";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  return handleRoute(async () => {
    await requireUser("customer.view");
    const { id } = await ctx.params;
    const detail = await getCustomerDetail(intId(id));
    return ok(detail);
  });
}

export async function PATCH(request: Request, ctx: Ctx) {
  return handleRoute(async () => {
    const user = await requireUser("customer.update");
    const { id } = await ctx.params;
    const body = await readJson<CustomerInput>(request);
    const customer = await updateCustomer(user, intId(id), body);
    return ok({ customer });
  });
}

export async function DELETE(request: Request, ctx: Ctx) {
  return handleRoute(async () => {
    const user = await requireUser("customer.delete");
    const { id } = await ctx.params;
    await deleteCustomer(user, intId(id));
    return ok({ ok: true });
  });
}
