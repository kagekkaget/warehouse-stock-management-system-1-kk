"use client";

import { useMemo, useState } from "react";
import { useApiData, useData } from "@/components/data-provider";
import { Badge, ErrorNote, Field, PageHeader, SectionCard, StatCard, TableSkeleton } from "@/components/ui";
import { can } from "@/lib/permissions";
import type { Role } from "@/lib/auth";
import { WASTE_REASON_LABEL, formatDate, formatNumber, formatRupiah, todayISO } from "@/lib/format";
import type { ProductRow, WasteRow } from "@/lib/types";

const REASONS = [
  { value: "expired", label: "Kedaluwarsa" },
  { value: "damaged", label: "Rusak / penyok" },
  { value: "spoiled", label: "Busuk / tidak layak jual" },
  { value: "lost", label: "Hilang" },
  { value: "other", label: "Lainnya" },
];

export default function PemborosanClient({ role }: { role: Role }) {
  const { mutate } = useData();
  const products = useApiData<{ items: ProductRow[] }>("/api/products");
  const [reason, setReason] = useState("semua");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ productId: "", quantity: "", reason: "expired", recordedAt: todayISO(), note: "" });

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (reason !== "semua") params.set("reason", reason);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return `/api/waste?${params.toString()}`;
  }, [reason, from, to]);

  const waste = useApiData<{ items: WasteRow[] }>(query);
  const items = waste.data?.items ?? [];
  const productOptions = (products.data?.items ?? []).filter((p) => p.quantity > 0);
  const selected = productOptions.find((p) => String(p.id) === form.productId);
  const estimatedLoss = selected ? Math.round(Number(form.quantity || 0) * selected.costPrice) : 0;
  const totalLoss = items.reduce((sum, row) => sum + row.valueLoss, 0);
  const totalUnits = items.reduce((sum, row) => sum + row.quantity, 0);

  async function submit() {
    if (!form.productId || !form.quantity) return;
    setBusy(true);
    const result = await mutate({
      method: "POST",
      path: "/api/waste",
      body: {
        productId: Number(form.productId),
        quantity: Number(form.quantity),
        reason: form.reason,
        recordedAt: form.recordedAt,
        note: form.note,
      },
      label: "Catatan pemborosan",
    });
    setBusy(false);
    if (result.ok) setForm({ ...form, productId: "", quantity: "", note: "" });
  }

  return (
    <>
      <PageHeader
        title="Pemborosan Stok"
        description="Catat barang kedaluwarsa, rusak, atau hilang untuk mengetahui sumber kerugian terbesar dan mencegahnya berulang."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Total Kerugian (terfilter)" value={formatRupiah(totalLoss)} tone="rose" icon="💸" />
        <StatCard label="Unit Terbuang" value={formatNumber(totalUnits)} tone="amber" icon="📦" />
        <StatCard label="Kejadian Tercatat" value={String(items.length)} tone="slate" icon="📝" />
      </div>

      {can(role, "waste.create") ? (
        <SectionCard
          title="Catat Pemborosan"
          description="Stok produk otomatis dikurangi dan tercatat sebagai mutasi pemborosan"
        >
          <div className="grid gap-3 lg:grid-cols-5">
            <Field label="Produk" className="lg:col-span-2">
              <select className="field" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}>
                <option value="">Pilih produk…</option>
                {productOptions.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} ({formatNumber(product.quantity)} {product.unit})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Jumlah terbuang" hint={selected ? `Stok tersedia ${formatNumber(selected.quantity)} ${selected.unit}` : undefined}>
              <input
                className="field"
                type="number"
                step="0.01"
                min="0.01"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
            </Field>
            <Field label="Penyebab">
              <select className="field" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}>
                {REASONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tanggal kejadian">
              <input
                className="field"
                type="date"
                value={form.recordedAt}
                onChange={(e) => setForm({ ...form, recordedAt: e.target.value })}
              />
            </Field>
            <Field label="Catatan" className="lg:col-span-4">
              <input
                className="field"
                placeholder="Contoh: chiller mati 1 malam, kemasan penyok saat pengiriman"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </Field>
            <div className="flex items-end">
              <button
                type="button"
                className="btn btn-primary w-full"
                disabled={busy || !form.productId || !form.quantity}
                onClick={() => void submit()}
              >
                {busy ? "Menyimpan…" : "Simpan"}
              </button>
            </div>
          </div>
          {estimatedLoss > 0 ? (
            <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              Estimasi kerugian: <strong className="tabular-nums">{formatRupiah(estimatedLoss)}</strong> ({formatNumber(Number(form.quantity))}{" "}
              {selected?.unit} × harga beli {formatRupiah(selected?.costPrice ?? 0)})
            </p>
          ) : null}
        </SectionCard>
      ) : null}

      <SectionCard
        title="Riwayat Pemborosan"
        description="Filter berdasarkan penyebab dan rentang tanggal"
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <select className="field max-w-[11rem]" value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="semua">Semua penyebab</option>
              {REASONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <input className="field max-w-[10rem]" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <input className="field max-w-[10rem]" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        }
      >
        {waste.error ? <ErrorNote message={waste.error} /> : null}
        {waste.loading && !waste.data ? (
          <TableSkeleton rows={5} cols={6} />
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-500">Tidak ada catatan pemborosan pada filter ini.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="pb-2">Tanggal</th>
                  <th className="pb-2">Produk</th>
                  <th className="pb-2 text-right">Jumlah</th>
                  <th className="pb-2">Penyebab</th>
                  <th className="pb-2 text-right">Kerugian</th>
                  <th className="pb-2">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((row) => (
                  <tr key={row.id}>
                    <td className="py-2 text-xs text-slate-600">{formatDate(row.recordedAt)}</td>
                    <td className="py-2 font-medium text-slate-800">{row.productName}</td>
                    <td className="py-2 text-right tabular-nums">
                      {formatNumber(row.quantity)} {row.unit}
                    </td>
                    <td className="py-2">
                      <Badge className="bg-rose-100 text-rose-700">{WASTE_REASON_LABEL[row.reason] ?? row.reason}</Badge>
                    </td>
                    <td className="py-2 text-right tabular-nums font-semibold text-rose-700">{formatRupiah(row.valueLoss)}</td>
                    <td className="py-2 text-xs text-slate-500">
                      {row.note ?? "-"}
                      <span className="block text-slate-400">oleh {row.userName ?? "-"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </>
  );
}
