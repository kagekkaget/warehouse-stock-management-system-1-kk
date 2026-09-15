"use client";

import { useMemo, useState } from "react";
import { useApiData, useData } from "@/components/data-provider";
import { Badge, ErrorNote, Field, PageHeader, SectionCard, TableSkeleton } from "@/components/ui";
import { can } from "@/lib/permissions";
import type { Role } from "@/lib/auth";
import { MOVEMENT_LABEL, formatDateTime, formatNumber } from "@/lib/format";
import type { MovementRow, ProductRow } from "@/lib/types";

const TYPES = [
  { value: "in", label: "Barang masuk" },
  { value: "out", label: "Barang keluar" },
  { value: "adjust", label: "Penyesuaian stok opname" },
];

export default function MutasiClient({ role }: { role: Role }) {
  const { mutate } = useData();
  const products = useApiData<{ items: ProductRow[] }>("/api/products");
  const [filter, setFilter] = useState("semua");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    productId: "",
    type: "in",
    quantity: "",
    reference: "",
    note: "",
  });

  const query = useMemo(() => `/api/movements?limit=200${filter === "semua" ? "" : `&type=${filter}`}`, [filter]);
  const movements = useApiData<{ items: MovementRow[] }>(query);

  const items = movements.data?.items ?? [];
  const productOptions = products.data?.items ?? [];
  const selected = productOptions.find((p) => String(p.id) === form.productId);

  async function submit() {
    if (!form.productId || !form.quantity) return;
    setBusy(true);
    const result = await mutate({
      method: "POST",
      path: "/api/movements",
      body: {
        productId: Number(form.productId),
        type: form.type,
        quantity: Number(form.quantity),
        reference: form.reference,
        note: form.note,
      },
      label: "Mutasi stok",
    });
    setBusy(false);
    if (result.ok) setForm({ productId: "", type: form.type, quantity: "", reference: "", note: "" });
  }

  return (
    <>
      <PageHeader
        title="Mutasi Stok"
        description="Riwayat barang masuk, keluar, penyesuaian, dan pemborosan. Setiap perubahan stok tercatat lengkap dengan pengguna."
        actions={
          <select className="field max-w-[12rem]" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="semua">Semua jenis</option>
            <option value="in">Barang masuk</option>
            <option value="out">Barang keluar</option>
            <option value="adjust">Penyesuaian</option>
            <option value="waste">Pemborosan</option>
          </select>
        }
      />

      {can(role, "movement.create") ? (
        <SectionCard title="Catat Mutasi Baru" description="Perubahan stok langsung diperbarui pada inventaris">
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
            <Field label="Jenis mutasi">
              <select className="field" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label={form.type === "adjust" ? "Stok hasil opname" : "Jumlah"}
              hint={selected ? `Stok saat ini ${formatNumber(selected.quantity)} ${selected.unit}` : undefined}
            >
              <input
                className="field"
                type="number"
                step="0.01"
                min="0"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
            </Field>
            <Field label="Referensi / Catatan">
              <input
                className="field"
                placeholder="No. faktur, nama pengambil, dsb."
                value={form.reference}
                onChange={(e) => setForm({ ...form, reference: e.target.value })}
              />
            </Field>
          </div>
          <div className="mt-3 flex justify-end">
            <button type="button" className="btn btn-primary" disabled={busy || !form.productId || !form.quantity} onClick={() => void submit()}>
              {busy ? "Menyimpan…" : "Simpan mutasi"}
            </button>
          </div>
          {form.type === "adjust" ? (
            <p className="mt-2 text-xs text-amber-700">
              Penyesuaian akan menimpa jumlah stok saat ini dengan nilai yang Anda masukkan (untuk stok opname).
            </p>
          ) : null}
        </SectionCard>
      ) : null}

      {movements.error ? <ErrorNote message={movements.error} /> : null}

      <SectionCard title="Riwayat Mutasi" description={`${items.length} catatan terakhir`}>
        {movements.loading && !movements.data ? (
          <TableSkeleton rows={8} cols={6} />
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-500">Belum ada mutasi stok.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="pb-2">Waktu</th>
                  <th className="pb-2">Produk</th>
                  <th className="pb-2">Jenis</th>
                  <th className="pb-2 text-right">Jumlah</th>
                  <th className="pb-2 text-right">Sisa stok</th>
                  <th className="pb-2">Referensi</th>
                  <th className="pb-2">Oleh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((row) => (
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
                    <td className="py-2 text-xs text-slate-600">
                      {row.reference ?? "-"}
                      {row.note ? <span className="block text-slate-400">{row.note}</span> : null}
                    </td>
                    <td className="py-2 text-xs text-slate-500">{row.userName ?? "-"}</td>
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
