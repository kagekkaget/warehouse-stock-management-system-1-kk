"use client";

import Link from "next/link";
import { useApiData } from "@/components/data-provider";
import { Badge, ErrorNote, PageHeader, SectionCard, StatCard, TableSkeleton, TrendChart } from "@/components/ui";
import {
  ALERT_BADGE,
  ALERT_LABEL,
  MOVEMENT_LABEL,
  WASTE_REASON_LABEL,
  daysUntil,
  formatDateTime,
  formatNumber,
  formatRupiah,
  stockStatus,
} from "@/lib/format";
import type { Role } from "@/lib/auth";
import type { ProductRow, SummaryResponse } from "@/lib/types";

export default function DashboardClient({ role }: { role: Role }) {
  const summary = useApiData<SummaryResponse>("/api/summary");
  const alerts = useApiData<{
    lowStock: ProductRow[];
    expiring: ProductRow[];
    expired: ProductRow[];
    potentialLoss: number;
    expiredLoss: number;
  }>("/api/alerts?days=30");

  const data = summary.data;
  const showMoney = role !== "staff";
  const urgentMap = new Map<number, ProductRow>();
  for (const product of [
    ...(alerts.data?.expired ?? []),
    ...(alerts.data?.expiring ?? []),
    ...(alerts.data?.lowStock ?? []),
  ]) {
    if (!urgentMap.has(product.id)) urgentMap.set(product.id, product);
  }
  const urgent = [...urgentMap.values()];

  return (
    <>
      <PageHeader
        title="Dasbor Gudang"
        description="Ringkasan stok, peringatan kedaluwarsa, penjualan, dan pemborosan untuk mengambil keputusan cepat."
        actions={
          <>
            <Link href="/laporan" className="btn btn-ghost">
              📑 Laporan
            </Link>
            <Link href="/pesanan" className="btn btn-primary">
              + Pesanan Baru
            </Link>
          </>
        }
      />

      {summary.error ? <ErrorNote message={summary.error} /> : null}

      {summary.loading && !data ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="skeleton h-24 rounded-2xl" />
          ))}
        </div>
      ) : null}

      {data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Nilai Persediaan"
              value={showMoney ? formatRupiah(data.inventory.stockValue) : `${formatNumber(data.inventory.totalProducts)} SKU`}
              hint={`${formatNumber(data.inventory.totalUnits)} unit · ${data.inventory.totalProducts} SKU`}
              tone="teal"
              icon="📦"
            />
            <StatCard
              label="Stok Rendah"
              value={String(data.alerts.lowStock)}
              hint="Sudah di bawah / sama dengan stok minimum"
              tone="amber"
              icon="⚠️"
            />
            <StatCard
              label="Segera Kedaluwarsa"
              value={String(data.alerts.expiring)}
              hint={`Potensi rugi ${formatRupiah(data.alerts.potentialLoss)} (≤30 hari)`}
              tone="rose"
              icon="⏳"
            />
            <StatCard
              label="Produk Kedaluwarsa"
              value={String(data.alerts.expired)}
              hint={`Kerugian ${formatRupiah(data.alerts.expiredLoss)}`}
              tone="rose"
              icon="🚫"
            />
            {showMoney ? (
              <>
                <StatCard
                  label="Penjualan Hari Ini"
                  value={formatRupiah(data.salesToday.revenue)}
                  hint={`${data.salesToday.count} pesanan`}
                  tone="sky"
                  icon="💰"
                />
                <StatCard
                  label="Penjualan Bulan Ini"
                  value={formatRupiah(data.salesMonth.revenue)}
                  hint={`${data.salesMonth.count} pesanan · terbayar ${formatRupiah(data.salesMonth.collected)}`}
                  tone="sky"
                  icon="📈"
                />
                <StatCard
                  label="Piutang Belum Tertagih"
                  value={formatRupiah(data.receivable.amount)}
                  hint={`${data.receivable.count} pesanan belum lunas`}
                  tone="amber"
                  icon="🧾"
                />
                <StatCard
                  label="Pemborosan Bulan Ini"
                  value={formatRupiah(data.wasteMonth.value)}
                  hint={`${data.wasteMonth.count} kejadian · ${formatNumber(data.wasteMonth.units)} unit terbuang`}
                  tone="rose"
                  icon="🗑️"
                />
              </>
            ) : (
              <>
                <StatCard label="Pelanggan Aktif" value={String(data.customers)} tone="sky" icon="👥" />
                <StatCard
                  label="Pesanan Bulan Ini"
                  value={String(data.salesMonth.count)}
                  hint="Akses nilai penjualan hanya untuk pemilik & manajer"
                  tone="sky"
                  icon="🧾"
                />
                <StatCard
                  label="Kejadian Pemborosan"
                  value={String(data.wasteMonth.count)}
                  hint={`${formatNumber(data.wasteMonth.units)} unit tercatat buang`}
                  tone="rose"
                  icon="🗑️"
                />
              </>
            )}
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <SectionCard
              title="Peringatan Prioritas"
              description="Produk yang perlu ditindaklanjuti segera"
              className="xl:col-span-2"
              actions={
                <Link href="/produk?status=expiring" className="text-xs font-semibold text-teal-700 hover:underline">
                  Lihat semua →
                </Link>
              }
            >
              {alerts.loading && !alerts.data ? (
                <TableSkeleton rows={4} cols={4} />
              ) : urgent.length === 0 ? (
                <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
                  Semua stok aman — tidak ada produk mendekati kedaluwarsa atau di bawah stok minimum.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[36rem] text-left text-sm">
                    <thead className="text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="pb-2">Produk</th>
                        <th className="pb-2">Stok</th>
                        <th className="pb-2">Kedaluwarsa</th>
                        <th className="pb-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {urgent.slice(0, 8).map((product) => {
                        const status = stockStatus(product);
                        const days = daysUntil(product.expiryDate);
                        return (
                          <tr key={`${product.id}-${status}`} className="align-middle">
                            <td className="py-2">
                              <p className="font-semibold text-slate-800">{product.name}</p>
                              <p className="text-xs text-slate-500">
                                {product.sku} · {product.category} · {product.location ?? "tanpa lokasi"}
                              </p>
                            </td>
                            <td className="py-2 tabular-nums">
                              {formatNumber(product.quantity)} {product.unit}
                              <span className="text-xs text-slate-400"> / min {formatNumber(product.minStock)}</span>
                            </td>
                            <td className="py-2 text-xs">
                              {product.expiryDate ?? "-"}
                              {days !== null ? (
                                <span className={days < 0 ? "text-rose-600" : "text-amber-600"}>
                                  {" "}
                                  ({days < 0 ? `lewat ${Math.abs(days)} hari` : `${days} hari lagi`})
                                </span>
                              ) : null}
                            </td>
                            <td className="py-2">
                              <Badge className={ALERT_BADGE[status]}>{ALERT_LABEL[status]}</Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>

            <SectionCard title="Pemborosan Bulan Ini" description="Berdasarkan penyebab">
              {data.wasteByReason.length === 0 ? (
                <p className="text-sm text-slate-500">Belum ada catatan pemborosan bulan ini.</p>
              ) : (
                <ul className="space-y-2">
                  {data.wasteByReason.map((item) => {
                    const total = data.wasteMonth.value || 1;
                    const percent = Math.round((item.value / total) * 100);
                    return (
                      <li key={item.reason}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-slate-700">
                            {WASTE_REASON_LABEL[item.reason] ?? item.reason}
                          </span>
                          <span className="tabular-nums text-slate-600">{formatRupiah(item.value)}</span>
                        </div>
                        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-rose-400" style={{ width: `${Math.max(4, percent)}%` }} />
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-500">{item.count} kejadian</p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </SectionCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            {showMoney ? (
              <SectionCard title="Tren Penjualan 14 Hari" description="Total nilai pesanan per hari" className="xl:col-span-2">
                <TrendChart data={data.trend} />
              </SectionCard>
            ) : (
              <SectionCard title="Aktivitas Stok Terbaru" description="8 mutasi terakhir" className="xl:col-span-2">
                <MovementTable rows={data.recentMovements} />
              </SectionCard>
            )}
            <SectionCard title={showMoney ? "Produk Terlaris Bulan Ini" : "Aktivitas Terbaru"}>
              {showMoney ? (
                data.topProducts.length === 0 ? (
                  <p className="text-sm text-slate-500">Belum ada penjualan bulan ini.</p>
                ) : (
                  <ol className="space-y-2 text-sm">
                    {data.topProducts.map((item, index) => (
                      <li key={item.productName} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-teal-100 text-[10px] font-bold text-teal-700">
                            {index + 1}
                          </span>
                          <span className="truncate font-medium text-slate-700">{item.productName}</span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block text-xs tabular-nums text-slate-600">{formatNumber(item.quantity)} unit</span>
                          <span className="block text-[11px] tabular-nums text-slate-500">{formatRupiah(item.revenue)}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                )
              ) : (
                <MovementTable rows={data.recentMovements} />
              )}
            </SectionCard>
          </div>

          {showMoney ? (
            <SectionCard title="Aktivitas Stok Terbaru" description="Jejak mutasi barang masuk, keluar, dan pemborosan">
              <MovementTable rows={data.recentMovements} />
            </SectionCard>
          ) : null}
        </>
      ) : null}
    </>
  );
}

function MovementTable({ rows }: { rows: SummaryResponse["recentMovements"] }) {
  if (!rows?.length) return <p className="text-sm text-slate-500">Belum ada mutasi stok.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="pb-2">Waktu</th>
            <th className="pb-2">Produk</th>
            <th className="pb-2">Jenis</th>
            <th className="pb-2 text-right">Jumlah</th>
            <th className="pb-2 text-right">Sisa</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="py-2 text-xs text-slate-500">{formatDateTime(row.createdAt)}</td>
              <td className="py-2 font-medium text-slate-800">{row.productName}</td>
              <td className="py-2">
                <Badge
                  className={
                    row.type === "in"
                      ? "bg-emerald-100 text-emerald-700"
                      : row.type === "out"
                        ? "bg-sky-100 text-sky-700"
                        : row.type === "waste"
                          ? "bg-rose-100 text-rose-700"
                          : "bg-slate-100 text-slate-700"
                  }
                >
                  {MOVEMENT_LABEL[row.type] ?? row.type}
                </Badge>
              </td>
              <td className="py-2 text-right tabular-nums">{formatNumber(row.quantity)}</td>
              <td className="py-2 text-right tabular-nums text-slate-500">{formatNumber(row.balanceAfter)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
