import { can } from "@/lib/permissions";
import { fail, handleRoute, requireUser } from "@/lib/http";
import { buildReport, type ReportType } from "@/lib/reports";
import { reportToCsv, reportToPdf } from "@/lib/export";

export const dynamic = "force-dynamic";

const TYPES: ReportType[] = ["inventaris", "penjualan", "pemborosan"];

function slug(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser();
    const url = new URL(request.url);
    const typeParam = (url.searchParams.get("type") ?? "inventaris") as ReportType;
    const type = TYPES.includes(typeParam) ? typeParam : "inventaris";
    const format = (url.searchParams.get("format") ?? "csv").toLowerCase();

    if (type === "penjualan" && !can(user.role, "report.financial")) {
      return fail(403, "Laporan penjualan hanya untuk pemilik dan manajer.");
    }

    const report = await buildReport(type, {
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
      category: url.searchParams.get("category") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
    });

    if (format === "pdf") {
      const bytes = await reportToPdf(report, { user: user.name });
      return new Response(bytes as unknown as BodyInit, {
        headers: {
          "content-type": "application/pdf",
          "content-disposition": `attachment; filename="laporan-${type}-${slug()}.pdf"`,
          "cache-control": "no-store",
        },
      });
    }

    const csv = reportToCsv(report);
    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="laporan-${type}-${slug()}.csv"`,
        "cache-control": "no-store",
      },
    });
  });
}
