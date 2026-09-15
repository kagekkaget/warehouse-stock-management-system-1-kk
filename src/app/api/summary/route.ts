import { handleRoute, ok, requireUser } from "@/lib/http";
import { getSummary } from "@/lib/services";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleRoute(async () => {
    const user = await requireUser("product.view");
    const summary = await getSummary();
    const financial = user.role !== "staff";
    if (!financial) {
      return ok({
        ...summary,
        salesToday: { count: summary.salesToday.count, revenue: 0 },
        salesMonth: { count: summary.salesMonth.count, revenue: 0, collected: 0 },
        receivable: { amount: 0, count: summary.receivable.count },
        topProducts: summary.topProducts.map((p) => ({ ...p, revenue: 0 })),
      });
    }
    return ok(summary);
  });
}
