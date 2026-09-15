import { handleRoute, intId, ok, readJson, requireUser } from "@/lib/http";
import { deleteProduct, updateProduct, type ProductInput } from "@/lib/services";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  return handleRoute(async () => {
    const user = await requireUser("product.update");
    const { id } = await ctx.params;
    const body = await readJson<ProductInput>(request);
    const product = await updateProduct(user, intId(id), body);
    return ok({ product });
  });
}

export async function DELETE(request: Request, ctx: Ctx) {
  return handleRoute(async () => {
    const user = await requireUser("product.delete");
    const { id } = await ctx.params;
    await deleteProduct(user, intId(id));
    return ok({ ok: true });
  });
}
