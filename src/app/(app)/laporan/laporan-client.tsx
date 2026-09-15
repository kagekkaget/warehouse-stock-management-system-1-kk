"use client";

import { useMemo, useState } from "react";
import { useApiData, useData } from "@/components/data-provider";
import { ErrorNote, Field, PageHeader, SectionCard, TableSkeleton, cx } from "@/components/ui";
import { can } from "@/lib/permissions";
import type { Role } from "@/lib/auth";
import { formatDate, formatNumber, formatRupiah, reportCellText } from "@/lib/format";
import type { ReportResponse } from "@/lib/types";

const REPORTS = [
  { id: "inventaris", label: "Inventaris", icon: "📦", description: "Posisi stok, nilai persediaan, dan status peringatan." },
  { id: "penjualan", label: "Penjualan", icon: "💰", description: "Rekap pesanan, pembayaran, dan margin kotor." },
  { id: "pemborosan", label: "Pemborosan", icon: "🗑️", description: "Kerugian dari barang kedaluwarsa, rusak, atau hilang." },
] as const;

function monthStart(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function LaporanClient({ role }: { role: Role }) {
  const { online, notify } = useData();
  const [type, setType] = useState<string>("inventaris");
  const [from, setFrom] = useState<string>(monthStart());
  const [to, setTo] = useState<string>(today());
  const [category, setCategory] = useState("semua");
  const [status, setStatus] = useState("semua");

  const categories = useApiData<{ categories: string[] }>("/api/products");

  const query = useMemo(() => {
    const params = new URLSearchParams({ type });
    if (type !== "inventaris") {
      if (from) params.set("from", from);
      if (to) params.set("to", to);
    } else {
      if (category !== "semua") params.set("category", category);
      if (status !== "semua") params.set("status", status);
    }
    return `/api/reports?${params.toString()}`;
  }, [type, from, to, category, status]);

  const report = useApiData<ReportResponse>(query);
  const data = report.data?.report;

  const available = REPORTS.filter((item) => item.id !== "penjualan" || can(role, "report.financial"));

  function exportUrl(format: "pdf" | "csv"): string {
    const params = new URLSearchParams({ type, format });
    if (type !== "inventaris") {
      if (from) params.set("from", from);
      if (to) params.set("to", to);
    } else {
      if (category !== "semua") params.set("category", category);
      if (status !== "semua") params.set("status", status);
    }
    return `/api/reports/export?${params.toString()}`;
  }

  function download(format: "pdf" | "csv") {
    if (!online) {
      notify("Ekspor laporan memerlukan koneksi internet. Coba lagi setelah online.", "error");
      return;
    }
    window.open(exportUrl(format), "_blank");
  }

  return (
    <>
      <PageHeader
        title="Laporan & Ekspor"
        description="Buat laporan inventaris, penjualan, dan pemborosan lalu unduh dalam format PDF atau CSV (kompatibel Excel)."
        actions={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => download("csv")}>
              ⬇️ Unduh CSV
            </button>
            <button type="button" className="btn btn-primary" onClick={() => download("pdf")}>
              🧾 Unduh PDF
            </button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {available.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setType(item.id)}
            className={cx(
              "card p-4 text-left transition",
              type === item.id ? "ring-2 ring-teal-500" : "hover:-translate-y-0.5 hover:shadow-lg",
            )}
          >
            <p className="text-sm font-bold text-slate-800">
              <span className="mr-1">{item.icon}</span> Laporan {item.label}
            </p>
            <p className="mt-1 text-xs text-slate-500">{item.description}</p>
          </button>
        ))}
      </div>

      <SectionCard title="Filter Laporan" description={data?.period}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {type === "inventaris" ? (
            <>
              <Field label="Kategori">
                <select className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="semua">Semua kategori</option>
                  {(categories.data?.categories ?? []).map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Status stok">
                <select className="field" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="semua">Semua status</option>
                  <option value="ok">Aman</option>
                  <option value="low">Stok rendah</option>
                  <option value="expiring">Segera kedaluwarsa</option>
                  <option value="expired">Sudah kedaluwarsa</option>
                </select>
              </Field>
            </>
          ) : (
            <>
              <Field label="Dari tanggal">
                <input className="field" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </Field>
              <Field label="Sampai tanggal">
                <input className="field" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </Field>
            </>
          )}
          <div className="flex items-end">
            <button
              type="button"
              className="btn btn-ghost w-full"
              onClick={() => {
                setFrom(monthStart());
                setTo(today());
                setCategory("semua");
                setStatus("semua");
              }}
            >
              Reset filter
            </button>
          </div>
        </div>
      </SectionCard>

      {report.error ? <ErrorNote message={report.error} /> : null}

      {data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {data.summary.map((item) => (
              <div key={item.label} className="card p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">
                  {item.type === "currency" ? formatRupiah(item.value) : formatNumber(item.value)}
                </p>
              </div>
            ))}
          </div>

          <SectionCard
            title={data.title}
            description={`${data.rows.length} baris · ${data.description}`}
            actions={
              <div className="flex gap-2">
                <button type="button" className="btn btn-ghost !py-1 text-xs" onClick={() => download("csv")}>
                  CSV
                </button>
                <button type="button" className="btn btn-ghost !py-1 text-xs" onClick={() => download("pdf")}>
                  PDF
                </button>
              </div>
            }
          >
            {report.loading && !data.rows.length ? (
              <TableSkeleton rows={6} cols={6} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[48rem] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      {data.columns.map((column) => (
                        <th key={column.key} className={cx("pb-2 whitespace-nowrap", column.type === "currency" || column.type === "number" ? "text-right" : "")}>
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.rows.length === 0 ? (
                      <tr>
                        <td colSpan={data.columns.length} className="py-6 text-center text-sm text-slate-500">
                          Tidak ada data pada filter ini.
                        </td>
                      </tr>
                    ) : (
                      data.rows.map((row, index) => (
                        <tr key={index} className="hover:bg-slate-50/70">
                          {data.columns.map((column) => (
                            <td
                              key={column.key}
                              className={cx(
                                "py-2 whitespace-nowrap",
                                column.type === "currency" || column.type === "number" ? "text-right tabular-nums" : "text-slate-700",
                              )}
                            >
                              {reportCellText(row[column.key], column.type)}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 text-[11px] text-slate-500">
              Nilai mata uang dalam Rupiah. Laporan dibuat otomatis dari data transaksi terbaru pada{" "}
              {formatDate(new Date().toISOString())}.
            </p>
          </SectionCard>
        </>
      ) : report.loading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : null}
    </>
  );
}
