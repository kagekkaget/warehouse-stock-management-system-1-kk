import { can } from "@/lib/permissions";
import { fail, handleRoute, ok, requireUser } from "@/lib/http";
import { buildReport, type ReportType } from "@/lib/reports";

export const dynamic = "force-dynamic";

const TYPES: ReportType[] = ["inventaris", "penjualan", "pemborosan"];

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser();
    const url = new URL(request.url);
    const typeParam = (url.searchParams.get("type") ?? "inventaris") as ReportType;
    const type = TYPES.includes(typeParam) ? typeParam : "inventaris";
    if (type === "penjualan" && !can(user.role, "report.financial")) {
      return fail(403, "Laporan penjualan hanya untuk pemilik dan manajer.");
    }
    const report = await buildReport(type, {
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
      category: url.searchParams.get("category") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
    });
    return ok({ report });
  });
}
