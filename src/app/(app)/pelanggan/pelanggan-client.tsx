"use client";

import { useMemo, useState } from "react";
import { useApiData, useData } from "@/components/data-provider";
import { Badge, EmptyState, ErrorNote, Field, Modal, PageHeader, SectionCard, StatCard, TableSkeleton, cx } from "@/components/ui";
import { can } from "@/lib/permissions";
import type { Role } from "@/lib/auth";
import {
  CUSTOMER_TYPE_LABEL,
  ORDER_STATUS_LABEL,
  PAYMENT_STATUS_BADGE,
  PAYMENT_STATUS_LABEL,
  formatDate,
  formatRupiah,
} from "@/lib/format";
import type { CustomerRow, OrderRow } from "@/lib/types";

type FormState = {
  id: number | null;
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  customerType: string;
  preferences: string;
  notes: string;
  consentMarketing: boolean;
};

const EMPTY: FormState = {
  id: null,
  name: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  customerType: "retail",
  preferences: "",
  notes: "",
  consentMarketing: false,
};

export default function PelangganClient({ role }: { role: Role }) {
  const { mutate } = useData();
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<FormState | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const query = useMemo(() => `/api/customers${search ? `?search=${encodeURIComponent(search)}` : ""}`, [search]);
  const customers = useApiData<{ items: CustomerRow[] }>(query);
  const detail = useApiData<{ customer: CustomerRow; orders: OrderRow[]; totalSpend: number; outstanding: number; orderCount: number }>(
    detailId ? `/api/customers/${detailId}` : null,
  );

  const items = customers.data?.items ?? [];

  async function save() {
    if (!form) return;
    setBusy(true);
    const payload = {
      name: form.name,
      phone: form.phone,
      email: form.email,
      address: form.address,
      city: form.city,
      customerType: form.customerType,
      preferences: form.preferences,
      notes: form.notes,
      consentMarketing: form.consentMarketing,
    };
    const result = form.id
      ? await mutate({ method: "PATCH", path: `/api/customers/${form.id}`, body: payload, label: "Perubahan pelanggan" })
      : await mutate({ method: "POST", path: "/api/customers", body: payload, label: "Pelanggan baru" });
    setBusy(false);
    if (result.ok) setForm(null);
  }

  async function remove(customer: CustomerRow) {
    const confirmed = window.confirm(
      `Hapus pelanggan "${customer.name}"? Riwayat pesanan tetap tersimpan tanpa tautan pelanggan (anonim).`,
    );
    if (!confirmed) return;
    await mutate({ method: "DELETE", path: `/api/customers/${customer.id}`, label: "Hapus pelanggan" });
    setDetailId(null);
  }

  return (
    <>
      <PageHeader
        title="Manajemen Pelanggan"
        description="Simpan profil, preferensi belanja, dan riwayat pesanan. Data pribadi hanya dipakai untuk keperluan operasional toko."
        actions={
          can(role, "customer.create") ? (
            <button type="button" className="btn btn-primary" onClick={() => setForm({ ...EMPTY })}>
              + Pelanggan Baru
            </button>
          ) : null
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Total Pelanggan" value={String(items.length)} tone="teal" icon="👥" />
        <StatCard
          label="Pelanggan Reseller/Grosir"
          value={String(items.filter((c) => c.customerType !== "retail").length)}
          tone="sky"
          icon="🤝"
        />
        <StatCard
          label="Menyetujui Komunikasi Pemasaran"
          value={String(items.filter((c) => c.consentMarketing).length)}
          hint="Persetujuan dapat dicabut kapan saja (UU PDP)"
          tone="amber"
          icon="✉️"
        />
      </div>

      <SectionCard
        title="Daftar Pelanggan"
        description="Cari berdasarkan nama, telepon, email, atau kota"
        actions={
          <input
            className="field max-w-[16rem]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari pelanggan…"
          />
        }
      >
        {customers.error ? <ErrorNote message={customers.error} /> : null}
        {customers.loading && !customers.data ? (
          <TableSkeleton rows={6} cols={5} />
        ) : items.length === 0 ? (
          <EmptyState title="Belum ada pelanggan" description="Tambahkan pelanggan untuk mencatat pesanan dan preferensi." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="pb-2">Nama</th>
                  <th className="pb-2">Kontak</th>
                  <th className="pb-2">Tipe</th>
                  <th className="pb-2">Preferensi</th>
                  <th className="pb-2 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((customer) => (
                  <tr key={customer.id}>
                    <td className="py-2.5">
                      <p className="font-semibold text-slate-800">{customer.name}</p>
                      <p className="text-xs text-slate-500">
                        {customer.city ?? "-"} · {customer.address ?? "alamat belum diisi"}
                      </p>
                    </td>
                    <td className="py-2.5 text-xs text-slate-600">
                      <p>{customer.phone ?? "-"}</p>
                      <p className="text-slate-400">{customer.email ?? "-"}</p>
                    </td>
                    <td className="py-2.5">
                      <Badge
                        className={
                          customer.customerType === "retail"
                            ? "bg-slate-100 text-slate-700"
                            : customer.customerType === "grosir"
                              ? "bg-sky-100 text-sky-700"
                              : "bg-violet-100 text-violet-700"
                        }
                      >
                        {CUSTOMER_TYPE_LABEL[customer.customerType] ?? customer.customerType}
                      </Badge>
                      {customer.consentMarketing ? (
                        <span className="ml-1 text-[10px] text-emerald-600" title="Menyetujui komunikasi pemasaran">
                          ✓ pemasaran
                        </span>
                      ) : null}
                    </td>
                    <td className="max-w-[16rem] py-2.5 text-xs text-slate-600">
                      <span className="line-clamp-2">{customer.preferences ?? "-"}</span>
                    </td>
                    <td className="py-2.5">
                      <div className="flex flex-wrap justify-end gap-1">
                        <button type="button" className="btn btn-ghost !px-2 !py-1 text-xs" onClick={() => setDetailId(customer.id)}>
                          Detail
                        </button>
                        {can(role, "customer.update") ? (
                          <button
                            type="button"
                            className="btn btn-ghost !px-2 !py-1 text-xs"
                            onClick={() =>
                              setForm({
                                id: customer.id,
                                name: customer.name,
                                phone: customer.phone ?? "",
                                email: customer.email ?? "",
                                address: customer.address ?? "",
                                city: customer.city ?? "",
                                customerType: customer.customerType,
                                preferences: customer.preferences ?? "",
                                notes: customer.notes ?? "",
                                consentMarketing: customer.consentMarketing,
                              })
                            }
                          >
                            Edit
                          </button>
                        ) : null}
                        {can(role, "customer.delete") ? (
                          <button type="button" className="btn btn-danger !px-2 !py-1 text-xs" onClick={() => void remove(customer)}>
                            Hapus
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <Modal
        open={detailId !== null}
        title={detail.data?.customer.name ?? "Detail Pelanggan"}
        description="Riwayat pesanan dan status pembayaran"
        onClose={() => setDetailId(null)}
        wide
      >
        {detail.loading && !detail.data ? (
          <TableSkeleton rows={4} cols={4} />
        ) : detail.data ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label="Total Pesanan" value={String(detail.data.orderCount)} tone="slate" />
              <StatCard label="Total Belanja" value={formatRupiah(detail.data.totalSpend)} tone="teal" />
              <StatCard label="Piutang Belum Bayar" value={formatRupiah(detail.data.outstanding)} tone="amber" />
            </div>
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase text-slate-500">Kontak</p>
                <p className="mt-1 text-slate-700">{detail.data.customer.phone ?? "-"}</p>
                <p className="text-slate-700">{detail.data.customer.email ?? "-"}</p>
                <p className="text-slate-600">
                  {detail.data.customer.address ?? "-"}, {detail.data.customer.city ?? "-"}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase text-slate-500">Preferensi</p>
                <p className="mt-1 text-slate-700">{detail.data.customer.preferences ?? "Belum ada catatan preferensi."}</p>
                <p className="mt-2 text-xs text-slate-500">Catatan: {detail.data.customer.notes ?? "-"}</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="pb-2">No. Pesanan</th>
                    <th className="pb-2">Tanggal</th>
                    <th className="pb-2 text-right">Total</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {detail.data.orders.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-3 text-center text-sm text-slate-500">
                        Belum ada pesanan untuk pelanggan ini.
                      </td>
                    </tr>
                  ) : (
                    detail.data.orders.map((order) => (
                      <tr key={order.id}>
                        <td className="py-2 font-medium text-slate-800">{order.orderNumber}</td>
                        <td className="py-2 text-xs text-slate-600">{formatDate(order.orderDate)}</td>
                        <td className="py-2 text-right tabular-nums">{formatRupiah(order.totalAmount)}</td>
                        <td className="py-2">
                          <Badge className={cx(PAYMENT_STATUS_BADGE[order.paymentStatus])}>
                            {PAYMENT_STATUS_LABEL[order.paymentStatus] ?? order.paymentStatus}
                          </Badge>
                          <span className="ml-1 text-[11px] text-slate-500">
                            {ORDER_STATUS_LABEL[order.status] ?? order.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <ErrorNote message={detail.error ?? "Data tidak tersedia."} />
        )}
      </Modal>

      <Modal
        open={form !== null}
        title={form?.id ? "Edit Pelanggan" : "Tambah Pelanggan"}
        description="Kumpulkan data secukupnya dan cantumkan persetujuan penggunaan data."
        onClose={() => setForm(null)}
        wide
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>
              Batal
            </button>
            <button type="button" className="btn btn-primary" disabled={busy || !form?.name} onClick={() => void save()}>
              {busy ? "Menyimpan…" : "Simpan pelanggan"}
            </button>
          </>
        }
      >
        {form ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nama pelanggan">
              <input className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Jenis pelanggan">
              <select className="field" value={form.customerType} onChange={(e) => setForm({ ...form, customerType: e.target.value })}>
                <option value="retail">Eceran</option>
                <option value="grosir">Grosir</option>
                <option value="reseller">Reseller</option>
              </select>
            </Field>
            <Field label="Telepon / WhatsApp">
              <input className="field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="Email">
              <input className="field" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Alamat">
              <input className="field" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </Field>
            <Field label="Kota">
              <input className="field" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </Field>
            <Field label="Preferensi belanja" className="sm:col-span-2" hint="Contoh: pesanan mingguan, minta produk dengan sisa masa simpan panjang">
              <textarea
                className="field"
                rows={2}
                value={form.preferences}
                onChange={(e) => setForm({ ...form, preferences: e.target.value })}
              />
            </Field>
            <Field label="Catatan internal" className="sm:col-span-2">
              <textarea className="field" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
            <label className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600 sm:col-span-2">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-teal-600"
                checked={form.consentMarketing}
                onChange={(e) => setForm({ ...form, consentMarketing: e.target.checked })}
              />
              <span>
                Pelanggan menyetujui penggunaan datanya untuk informasi promo. Persetujuan ini dicatat sebagai dasar
                pemrosesan sesuai UU No. 27/2022 dan dapat dicabut kapan saja.
              </span>
            </label>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
