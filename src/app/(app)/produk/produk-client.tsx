"use client";

import { useEffect, useMemo, useState } from "react";
import { useApiData, useData } from "@/components/data-provider";
import { Badge, EmptyState, ErrorNote, Field, Modal, PageHeader, SectionCard, TableSkeleton, cx } from "@/components/ui";
import { can } from "@/lib/permissions";
import type { Role } from "@/lib/auth";
import {
  ALERT_BADGE,
  ALERT_LABEL,
  daysUntil,
  formatDate,
  formatNumber,
  formatRupiah,
  stockStatus,
  todayISO,
} from "@/lib/format";
import type { ProductRow } from "@/lib/types";

type FormState = {
  id: number | null;
  sku: string;
  name: string;
  category: string;
  unit: string;
  quantity: string;
  minStock: string;
  costPrice: string;
  sellPrice: string;
  expiryDate: string;
  location: string;
  supplier: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  id: null,
  sku: "",
  name: "",
  category: "",
  unit: "pcs",
  quantity: "0",
  minStock: "0",
  costPrice: "0",
  sellPrice: "0",
  expiryDate: "",
  location: "",
  supplier: "",
  notes: "",
};

const STATUS_OPTIONS = [
  { value: "semua", label: "Semua status" },
  { value: "ok", label: "Aman" },
  { value: "low", label: "Stok rendah" },
  { value: "expiring", label: "Segera kedaluwarsa" },
  { value: "expired", label: "Sudah kedaluwarsa" },
  { value: "out", label: "Stok habis" },
];

export default function ProdukClient({ role }: { role: Role }) {
  const { mutate } = useData();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("semua");
  const [status, setStatus] = useState("semua");
  const [form, setForm] = useState<FormState | null>(null);
  const [restock, setRestock] = useState<{ product: ProductRow; quantity: string; note: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initial = params.get("status");
    if (initial) setStatus(initial);
  }, []);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (category !== "semua") params.set("category", category);
    if (status !== "semua") params.set("status", status);
    return `/api/products?${params.toString()}`;
  }, [search, category, status]);

  const { data, loading, error, fromCache } = useApiData<{ items: ProductRow[]; categories: string[] }>(query);

  const items = data?.items ?? [];
  const totals = items.reduce(
    (acc, item) => {
      acc.value += item.quantity * item.costPrice;
      acc.units += item.quantity;
      return acc;
    },
    { value: 0, units: 0 },
  );

  function openCreate() {
    setForm({ ...EMPTY_FORM, expiryDate: "" });
  }

  function openEdit(product: ProductRow) {
    setForm({
      id: product.id,
      sku: product.sku,
      name: product.name,
      category: product.category,
      unit: product.unit,
      quantity: String(product.quantity),
      minStock: String(product.minStock),
      costPrice: String(product.costPrice),
      sellPrice: String(product.sellPrice),
      expiryDate: product.expiryDate ?? "",
      location: product.location ?? "",
      supplier: product.supplier ?? "",
      notes: product.notes ?? "",
    });
  }

  async function saveForm() {
    if (!form) return;
    setBusy(true);
    const payload = {
      sku: form.sku,
      name: form.name,
      category: form.category || "Umum",
      unit: form.unit,
      quantity: Number(form.quantity || 0),
      minStock: Number(form.minStock || 0),
      costPrice: Number(form.costPrice || 0),
      sellPrice: Number(form.sellPrice || 0),
      expiryDate: form.expiryDate || null,
      location: form.location,
      supplier: form.supplier,
      notes: form.notes,
    };
    const result = form.id
      ? await mutate({ method: "PATCH", path: `/api/products/${form.id}`, body: payload, label: "Perubahan produk" })
      : await mutate({ method: "POST", path: "/api/products", body: payload, label: "Produk baru" });
    setBusy(false);
    if (result.ok && !result.error) setForm(null);
  }

  async function removeProduct(product: ProductRow) {
    const confirmed = window.confirm(`Hapus "${product.name}"? Riwayat mutasi terkait juga akan dihapus.`);
    if (!confirmed) return;
    await mutate({ method: "DELETE", path: `/api/products/${product.id}`, label: "Hapus produk" });
  }

  async function saveRestock() {
    if (!restock) return;
    setBusy(true);
    const result = await mutate({
      method: "POST",
      path: "/api/movements",
      body: {
        productId: restock.product.id,
        type: "in",
        quantity: Number(restock.quantity || 0),
        reference: "Penerimaan barang",
        note: restock.note,
      },
      label: "Barang masuk",
    });
    setBusy(false);
    if (result.ok) setRestock(null);
  }

  return (
    <>
      <PageHeader
        title="Inventaris Gudang"
        description="Kelola produk, stok minimum, harga, dan tanggal kedaluwarsa. Semua perubahan tercatat sebagai mutasi stok."
        actions={
          can(role, "product.create") ? (
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              + Produk Baru
            </button>
          ) : null
        }
      />

      <SectionCard
        title="Filter & Pencarian"
        description={`${items.length} produk ditampilkan · ${formatNumber(totals.units)} unit · nilai ${formatRupiah(totals.value)}`}
        actions={fromCache ? <Badge className="bg-slate-100 text-slate-600">data offline</Badge> : null}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Cari produk / SKU / pemasok">
            <input
              className="field"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Contoh: susu atau MK-003"
            />
          </Field>
          <Field label="Kategori">
            <select className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="semua">Semua kategori</option>
              {(data?.categories ?? []).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status stok">
            <select className="field" value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex items-end">
            <button
              type="button"
              className="btn btn-ghost w-full"
              onClick={() => {
                setSearch("");
                setCategory("semua");
                setStatus("semua");
              }}
            >
              Reset filter
            </button>
          </div>
        </div>
      </SectionCard>

      {error ? <ErrorNote message={error} /> : null}

      <SectionCard title="Daftar Produk">
        {loading && !data ? (
          <TableSkeleton rows={6} cols={6} />
        ) : items.length === 0 ? (
          <EmptyState
            title="Tidak ada produk yang cocok"
            description="Ubah filter atau tambahkan produk baru ke gudang."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[54rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="pb-2">Produk</th>
                  <th className="pb-2">Kategori</th>
                  <th className="pb-2 text-right">Stok</th>
                  <th className="pb-2 text-right">Harga</th>
                  <th className="pb-2">Kedaluwarsa</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((product) => {
                  const state = stockStatus(product);
                  const days = daysUntil(product.expiryDate);
                  return (
                    <tr key={product.id} className={cx(state === "expired" && "bg-rose-50/50")}>
                      <td className="py-2.5">
                        <p className="font-semibold text-slate-800">{product.name}</p>
                        <p className="text-xs text-slate-500">
                          {product.sku} · {product.location ?? "tanpa lokasi"} · {product.supplier ?? "pemasok tidak dicatat"}
                        </p>
                      </td>
                      <td className="py-2.5 text-xs text-slate-600">{product.category}</td>
                      <td className="py-2.5 text-right tabular-nums">
                        <span className={product.quantity <= product.minStock ? "font-bold text-rose-600" : "font-semibold"}>
                          {formatNumber(product.quantity)}
                        </span>{" "}
                        <span className="text-xs text-slate-500">{product.unit}</span>
                        <p className="text-[11px] text-slate-400">min. {formatNumber(product.minStock)}</p>
                      </td>
                      <td className="py-2.5 text-right text-xs tabular-nums text-slate-600">
                        <p>{formatRupiah(product.sellPrice)}</p>
                        <p className="text-slate-400">beli {formatRupiah(product.costPrice)}</p>
                      </td>
                      <td className="py-2.5 text-xs">
                        {product.expiryDate ? (
                          <>
                            <p className="text-slate-700">{formatDate(product.expiryDate)}</p>
                            <p className={cx(days !== null && days < 0 ? "text-rose-600" : days !== null && days <= 30 ? "text-amber-600" : "text-slate-400")}>
                              {days !== null ? (days < 0 ? `lewat ${Math.abs(days)} hari` : `${days} hari lagi`) : ""}
                            </p>
                          </>
                        ) : (
                          <span className="text-slate-400">tidak ada</span>
                        )}
                      </td>
                      <td className="py-2.5">
                        <Badge className={ALERT_BADGE[state]}>{ALERT_LABEL[state]}</Badge>
                      </td>
                      <td className="py-2.5">
                        <div className="flex flex-wrap justify-end gap-1">
                          {can(role, "movement.create") ? (
                            <button
                              type="button"
                              className="btn btn-ghost !px-2 !py-1 text-xs"
                              onClick={() => setRestock({ product, quantity: "", note: "" })}
                            >
                              + Stok
                            </button>
                          ) : null}
                          {can(role, "product.update") ? (
                            <button type="button" className="btn btn-ghost !px-2 !py-1 text-xs" onClick={() => openEdit(product)}>
                              Edit
                            </button>
                          ) : null}
                          {can(role, "product.delete") ? (
                            <button
                              type="button"
                              className="btn btn-danger !px-2 !py-1 text-xs"
                              onClick={() => void removeProduct(product)}
                            >
                              Hapus
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <Modal
        open={form !== null}
        title={form?.id ? "Edit Produk" : "Tambah Produk Baru"}
        description="Isi detail produk. Jika stok diubah, sistem otomatis membuat catatan penyesuaian."
        onClose={() => setForm(null)}
        wide
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>
              Batal
            </button>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void saveForm()}>
              {busy ? "Menyimpan…" : "Simpan produk"}
            </button>
          </>
        }
      >
        {form ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nama produk" className="sm:col-span-2">
              <input className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="SKU / Kode barang" hint="Kosongkan untuk dibuat otomatis">
              <input className="field" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            </Field>
            <Field label="Kategori">
              <input
                className="field"
                list="kategori-list"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
              <datalist id="kategori-list">
                {(data?.categories ?? []).map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </Field>
            <Field label="Satuan">
              <input className="field" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </Field>
            <Field label="Lokasi penyimpanan">
              <input className="field" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </Field>
            <Field label="Jumlah stok">
              <input
                className="field"
                type="number"
                step="0.01"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
            </Field>
            <Field label="Stok minimum" hint="Dasar peringatan stok rendah">
              <input
                className="field"
                type="number"
                step="0.01"
                value={form.minStock}
                onChange={(e) => setForm({ ...form, minStock: e.target.value })}
              />
            </Field>
            <Field label="Harga beli (Rp)">
              <input
                className="field"
                type="number"
                value={form.costPrice}
                onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
              />
            </Field>
            <Field label="Harga jual (Rp)">
              <input
                className="field"
                type="number"
                value={form.sellPrice}
                onChange={(e) => setForm({ ...form, sellPrice: e.target.value })}
              />
            </Field>
            <Field label="Tanggal kedaluwarsa" hint="Kosongkan jika tidak berlaku">
              <input
                className="field"
                type="date"
                value={form.expiryDate}
                onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
              />
            </Field>
            <Field label="Pemasok">
              <input className="field" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
            </Field>
            <Field label="Catatan" className="sm:col-span-2">
              <textarea
                className="field"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={restock !== null}
        title="Catat Barang Masuk"
        description={restock ? `${restock.product.name} · stok saat ini ${formatNumber(restock.product.quantity)} ${restock.product.unit}` : ""}
        onClose={() => setRestock(null)}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setRestock(null)}>
              Batal
            </button>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void saveRestock()}>
              Simpan mutasi
            </button>
          </>
        }
      >
        {restock ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Jumlah masuk">
              <input
                className="field"
                type="number"
                step="0.01"
                min="0.01"
                value={restock.quantity}
                onChange={(e) => setRestock({ ...restock, quantity: e.target.value })}
              />
            </Field>
            <Field label="Referensi">
              <input
                className="field"
                placeholder="No. faktur pemasok"
                value={restock.note}
                onChange={(e) => setRestock({ ...restock, note: e.target.value })}
              />
            </Field>
            <p className="text-xs text-slate-500 sm:col-span-2">
              Tanggal pencatatan: {formatDate(todayISO())}. Stok bertambah setelah disimpan.
            </p>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
