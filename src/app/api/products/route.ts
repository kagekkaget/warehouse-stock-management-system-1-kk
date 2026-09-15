import { handleRoute, ok, readJson, requireUser } from "@/lib/http";
import { createProduct, listCategories, listProducts, type ProductInput } from "@/lib/services";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleRoute(async () => {
    await requireUser("product.view");
    const url = new URL(request.url);
    const items = await listProducts({
      search: url.searchParams.get("search") ?? undefined,
      category: url.searchParams.get("category") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
    });
    const categories = await listCategories();
    return ok({ items, categories, total: items.length });
  });
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser("product.create");
    const body = await readJson<ProductInput>(request);
    const product = await createProduct(user, body);
    return ok({ product }, { status: 201 });
  });
}
