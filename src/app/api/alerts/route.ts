import { handleRoute, ok, requireUser } from "@/lib/http";
import { getAlerts } from "@/lib/services";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleRoute(async () => {
    await requireUser("product.view");
    const url = new URL(request.url);
    const days = Number(url.searchParams.get("days") ?? 30);
    const alerts = await getAlerts(Number.isFinite(days) ? days : 30);
    return ok({
      lowStock: alerts.lowStock,
      expiring: alerts.expiring,
      expired: alerts.expired,
      potentialLoss: alerts.potentialLoss,
      expiredLoss: alerts.expiredLoss,
    });
  });
}
