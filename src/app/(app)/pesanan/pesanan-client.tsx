"use client";

import { useMemo, useState } from "react";
import { useApiData, useData } from "@/components/data-provider";
import { Badge, EmptyState, ErrorNote, Field, Modal, PageHeader, SectionCard, StatCard, TableSkeleton, cx } from "@/components/ui";
import { can } from "@/lib/permissions";
import type { Role } from "@/lib/auth";
import {
  ORDER_STATUS_LABEL,
  PAYMENT_STATUS_BADGE,
  PAYMENT_STATUS_LABEL,
  formatDate,
  formatNumber,
  formatRupiah,
  todayISO,
} from "@/lib/format";
import type { CustomerRow, OrderItemRow, OrderRow, ProductRow } from "@/lib/types";

type LineItem = { key: string; productId: string; quantity: string; unitPrice: string };

function newLine(): LineItem {
  return { key: `${Date.now()}-${Math.random().toString(16).slice(2, 7)}`, productId: "", quantity: "1", unitPrice: "" };
}

export default function PesananClient({ role }: { role: Role }) {
  const { mutate } = useData();
  const [search, setSearch] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("semua");
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [payForm, setPayForm] = useState<{ order: OrderRow; paidAmount: string; status: string; dueDate: string } | null>(null);

  const [order, setOrder] = useState({
    customerId: "",
    orderDate: todayISO(),
    dueDate: "",
    paymentMethod: "cash",
    paidAmount: "0",
    status: "confirmed",
    notes: "",
  });
  const [lines, setLines] = useState<LineItem[]>([newLine()]);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (paymentStatus !== "semua") params.set("paymentStatus", paymentStatus);
    return `/api/orders?${params.toString()}`;
  }, [search, paymentStatus]);

  const orders = useApiData<{ items: OrderRow[]; orderItems: OrderItemRow[] }>(query);
  const customers = useApiData<{ items: CustomerRow[] }>("/api/customers");
  const products = useApiData<{ items: ProductRow[] }>("/api/products");
  const detail = useApiData<{ order: OrderRow; items: OrderItemRow[] }>(detailId ? `/api/orders/${detailId}` : null);

  const rows = orders.data?.items ?? [];
  const allItems = orders.data?.orderItems ?? [];
  const productOptions = products.data?.items ?? [];
  const customerOptions = customers.data?.items ?? [];

  const totalRevenue = rows.filter((r) => r.status !== "cancelled").reduce((sum, r) => sum + r.totalAmount, 0);
  const totalPaid = rows.reduce((sum, r) => sum + r.paidAmount, 0);
  const totalDue = Math.max(0, totalRevenue - totalPaid);

  const lineTotal = lines.reduce((sum, line) => {
    const product = productOptions.find((p) => String(p.id) === line.productId);
    const price = Number(line.unitPrice || product?.sellPrice || 0);
    return sum + price * Number(line.quantity || 0);
  }, 0);

  async function createOrder() {
    const items = lines
      .filter((line) => line.productId && Number(line.quantity) > 0)
      .map((line) => {
        const product = productOptions.find((p) => String(p.id) === line.productId);
        return {
          productId: Number(line.productId),
          quantity: Number(line.quantity),
          unitPrice: Number(line.unitPrice || product?.sellPrice || 0),
        };
      });
    if (!items.length) return;
    setBusy(true);
    const result = await mutate({
      method: "POST",
      path: "/api/orders",
      body: {
        customerId: order.customerId || null,
        orderDate: order.orderDate,
        dueDate: order.dueDate || null,
        paymentMethod: order.paymentMethod,
        paidAmount: Number(order.paidAmount || 0),
        status: order.status,
        notes: order.notes,
        items,
      },
      label: "Pesanan baru",
    });
    setBusy(false);
    if (result.ok) {
      setShowCreate(false);
      setLines([newLine()]);
      setOrder({ ...order, customerId: "", paidAmount: "0", notes: "", dueDate: "" });
    }
  }

  async function savePayment() {
    if (!payForm) return;
    setBusy(true);
    const result = await mutate({
      method: "PATCH",
      path: `/api/orders/${payForm.order.id}`,
      body: {
        paidAmount: Number(payForm.paidAmount || 0),
        status: payForm.status,
        dueDate: payForm.dueDate || null,
      },
      label: "Pembaruan pesanan",
    });
    setBusy(false);
    if (result.ok) setPayForm(null);
  }

  async function removeOrder(row: OrderRow) {
    if (!window.confirm(`Hapus pesanan ${row.orderNumber}? Stok tidak dikembalikan otomatis.`)) return;
    await mutate({ method: "DELETE", path: `/api/orders/${row.id}`, label: "Hapus pesanan" });
    setDetailId(null);
  }

  return (
    <>
      <PageHeader
        title="Pesanan & Pembayaran"
        description="Catat penjualan, pantau status pembayaran, dan kurangi stok otomatis setiap pesanan dibuat."
        actions={
          can(role, "order.create") ? (
            <button type="button" className="btn btn-primary" onClick={() => setShowCreate(true)}>
              + Pesanan Baru
            </button>
          ) : null
        }
      />

      {role !== "staff" ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Total Pesanan" value={String(rows.length)} tone="sky" icon="🧾" />
          <StatCard label="Nilai Penjualan (terfilter)" value={formatRupiah(totalRevenue)} tone="teal" icon="💰" />
          <StatCard label="Piutang Belum Tertagih" value={formatRupiah(totalDue)} tone="amber" icon="⏰" />
        </div>
      ) : null}

      <SectionCard
        title="Daftar Pesanan"
        description="Klik Detail untuk melihat rincian item"
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <input
              className="field max-w-[14rem]"
              placeholder="Cari no. pesanan / pelanggan"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select className="field max-w-[12rem]" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
              <option value="semua">Semua status bayar</option>
              <option value="paid">Lunas</option>
              <option value="partial">Bayar sebagian</option>
              <option value="unpaid">Belum bayar</option>
              <option value="overdue">Jatuh tempo</option>
            </select>
          </div>
        }
      >
        {orders.error ? <ErrorNote message={orders.error} /> : null}
        {orders.loading && !orders.data ? (
          <TableSkeleton rows={6} cols={7} />
        ) : rows.length === 0 ? (
          <EmptyState title="Belum ada pesanan" description="Buat pesanan pertama untuk mulai melacak penjualan dan pembayaran." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="pb-2">No. Pesanan</th>
                  <th className="pb-2">Tanggal</th>
                  <th className="pb-2">Pelanggan</th>
                  <th className="pb-2">Item</th>
                  <th className="pb-2 text-right">Total</th>
                  <th className="pb-2 text-right">Dibayar</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => {
                  const items = allItems.filter((item) => item.orderId === row.id);
                  return (
                    <tr key={row.id} className={row.paymentStatus === "overdue" ? "bg-rose-50/40" : undefined}>
                      <td className="py-2.5 font-semibold text-slate-800">{row.orderNumber}</td>
                      <td className="py-2.5 text-xs text-slate-600">
                        {formatDate(row.orderDate)}
                        {row.dueDate ? <span className="block text-slate-400">tempo {formatDate(row.dueDate)}</span> : null}
                      </td>
                      <td className="py-2.5 text-slate-700">{row.customerName ?? "Pelanggan umum"}</td>
                      <td className="py-2.5 text-xs text-slate-500">
                        {items.length ? `${items.length} item · ${formatNumber(items.reduce((s, i) => s + i.quantity, 0))} unit` : "-"}
                      </td>
                      <td className="py-2.5 text-right tabular-nums">{formatRupiah(row.totalAmount)}</td>
                      <td className="py-2.5 text-right tabular-nums text-slate-600">{formatRupiah(row.paidAmount)}</td>
                      <td className="py-2.5">
                        <Badge className={cx(PAYMENT_STATUS_BADGE[row.paymentStatus])}>
                          {PAYMENT_STATUS_LABEL[row.paymentStatus] ?? row.paymentStatus}
                        </Badge>
                        <span className="block text-[11px] text-slate-500">{ORDER_STATUS_LABEL[row.status] ?? row.status}</span>
                      </td>
                      <td className="py-2.5">
                        <div className="flex flex-wrap justify-end gap-1">
                          <button type="button" className="btn btn-ghost !px-2 !py-1 text-xs" onClick={() => setDetailId(row.id)}>
                            Detail
                          </button>
                          {can(role, "order.update") ? (
                            <button
                              type="button"
                              className="btn btn-ghost !px-2 !py-1 text-xs"
                              onClick={() =>
                                setPayForm({
                                  order: row,
                                  paidAmount: String(row.paidAmount),
                                  status: row.status,
                                  dueDate: row.dueDate ?? "",
                                })
                              }
                            >
                              Bayar
                            </button>
                          ) : null}
                          {can(role, "order.delete") ? (
                            <button type="button" className="btn btn-danger !px-2 !py-1 text-xs" onClick={() => void removeOrder(row)}>
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
        open={showCreate}
        title="Buat Pesanan Baru"
        description="Stok produk otomatis berkurang sesuai item yang dijual."
        onClose={() => setShowCreate(false)}
        wide
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>
              Batal
            </button>
            <button type="button" className="btn btn-primary" disabled={busy || lineTotal <= 0} onClick={() => void createOrder()}>
              {busy ? "Menyimpan…" : `Simpan pesanan · ${formatRupiah(lineTotal)}`}
            </button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Pelanggan">
            <select className="field" value={order.customerId} onChange={(e) => setOrder({ ...order, customerId: e.target.value })}>
              <option value="">Pelanggan umum (tanpa profil)</option>
              {customerOptions.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tanggal pesanan">
            <input className="field" type="date" value={order.orderDate} onChange={(e) => setOrder({ ...order, orderDate: e.target.value })} />
          </Field>
          <Field label="Jatuh tempo (opsional)">
            <input className="field" type="date" value={order.dueDate} onChange={(e) => setOrder({ ...order, dueDate: e.target.value })} />
          </Field>
        </div>

        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Item pesanan</p>
          {lines.map((line, index) => {
            const product = productOptions.find((p) => String(p.id) === line.productId);
            return (
              <div key={line.key} className="grid gap-2 rounded-xl bg-slate-50 p-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
                <select
                  className="field"
                  value={line.productId}
                  onChange={(e) => {
                    const next = [...lines];
                    next[index] = { ...line, productId: e.target.value, unitPrice: "" };
                    setLines(next);
                  }}
                >
                  <option value="">Pilih produk…</option>
                  {productOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {formatNumber(item.quantity)} {item.unit}
                    </option>
                  ))}
                </select>
                <input
                  className="field"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={line.quantity}
                  onChange={(e) => {
                    const next = [...lines];
                    next[index] = { ...line, quantity: e.target.value };
                    setLines(next);
                  }}
                />
                <input
                  className="field"
                  type="number"
                  min="0"
                  placeholder={String(product?.sellPrice ?? 0)}
                  value={line.unitPrice}
                  onChange={(e) => {
                    const next = [...lines];
                    next[index] = { ...line, unitPrice: e.target.value };
                    setLines(next);
                  }}
                />
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setLines(lines.length > 1 ? lines.filter((_, i) => i !== index) : lines)}
                >
                  ✕
                </button>
              </div>
            );
          })}
          <button type="button" className="btn btn-ghost" onClick={() => setLines([...lines, newLine()])}>
            + Tambah item
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Field label="Metode pembayaran">
            <select className="field" value={order.paymentMethod} onChange={(e) => setOrder({ ...order, paymentMethod: e.target.value })}>
              <option value="cash">Tunai</option>
              <option value="transfer">Transfer bank</option>
              <option value="qris">QRIS</option>
              <option value="tempo">Tempo / kredit</option>
            </select>
          </Field>
          <Field label="Jumlah dibayar (Rp)">
            <input
              className="field"
              type="number"
              min="0"
              value={order.paidAmount}
              onChange={(e) => setOrder({ ...order, paidAmount: e.target.value })}
            />
          </Field>
          <Field label="Status pesanan">
            <select className="field" value={order.status} onChange={(e) => setOrder({ ...order, status: e.target.value })}>
              {Object.entries(ORDER_STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Catatan" className="sm:col-span-3">
            <input className="field" value={order.notes} onChange={(e) => setOrder({ ...order, notes: e.target.value })} />
          </Field>
        </div>
        <p className="mt-3 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-800">
          Total pesanan: <strong className="tabular-nums">{formatRupiah(lineTotal)}</strong>
          {Number(order.paidAmount || 0) < lineTotal ? (
            <span> · sisa {formatRupiah(lineTotal - Number(order.paidAmount || 0))} akan tercatat sebagai piutang.</span>
          ) : (
            <span> · pesanan akan ditandai lunas.</span>
          )}
        </p>
      </Modal>

      <Modal open={detailId !== null} title={detail.data?.order.orderNumber ?? "Detail Pesanan"} onClose={() => setDetailId(null)}>
        {detail.loading && !detail.data ? (
          <TableSkeleton rows={3} cols={3} />
        ) : detail.data ? (
          <div className="space-y-3 text-sm">
            <div className="grid gap-2 sm:grid-cols-2">
              <p className="text-slate-600">
                Pelanggan: <strong className="text-slate-800">{detail.data.order.customerName ?? "Pelanggan umum"}</strong>
              </p>
              <p className="text-slate-600">Tanggal: {formatDate(detail.data.order.orderDate)}</p>
              <p className="text-slate-600">Metode: {detail.data.order.paymentMethod}</p>
              <p className="text-slate-600">
                Status: {ORDER_STATUS_LABEL[detail.data.order.status] ?? detail.data.order.status} ·{" "}
                {PAYMENT_STATUS_LABEL[detail.data.order.paymentStatus] ?? detail.data.order.paymentStatus}
              </p>
            </div>
            <table className="w-full text-left">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="pb-2">Produk</th>
                  <th className="pb-2 text-right">Qty</th>
                  <th className="pb-2 text-right">Harga</th>
                  <th className="pb-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {detail.data.items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2">{item.productName}</td>
                    <td className="py-2 text-right tabular-nums">{formatNumber(item.quantity)}</td>
                    <td className="py-2 text-right tabular-nums">{formatRupiah(item.unitPrice)}</td>
                    <td className="py-2 text-right tabular-nums">{formatRupiah(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="flex justify-between">
                <span className="text-slate-600">Total</span>
                <strong className="tabular-nums">{formatRupiah(detail.data.order.totalAmount)}</strong>
              </p>
              <p className="flex justify-between">
                <span className="text-slate-600">Dibayar</span>
                <span className="tabular-nums">{formatRupiah(detail.data.order.paidAmount)}</span>
              </p>
              <p className="flex justify-between">
                <span className="text-slate-600">Sisa</span>
                <span className="tabular-nums">{formatRupiah(Math.max(0, detail.data.order.totalAmount - detail.data.order.paidAmount))}</span>
              </p>
              {detail.data.order.notes ? <p className="mt-1 text-xs text-slate-500">Catatan: {detail.data.order.notes}</p> : null}
            </div>
          </div>
        ) : (
          <ErrorNote message={detail.error ?? "Data tidak tersedia."} />
        )}
      </Modal>

      <Modal
        open={payForm !== null}
        title="Perbarui Pembayaran"
        description={payForm ? `${payForm.order.orderNumber} · total ${formatRupiah(payForm.order.totalAmount)}` : ""}
        onClose={() => setPayForm(null)}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setPayForm(null)}>
              Batal
            </button>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void savePayment()}>
              {busy ? "Menyimpan…" : "Simpan"}
            </button>
          </>
        }
      >
        {payForm ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Jumlah dibayar (Rp)">
              <input
                className="field"
                type="number"
                min="0"
                value={payForm.paidAmount}
                onChange={(e) => setPayForm({ ...payForm, paidAmount: e.target.value })}
              />
            </Field>
            <Field label="Status pesanan">
              <select className="field" value={payForm.status} onChange={(e) => setPayForm({ ...payForm, status: e.target.value })}>
                {Object.entries(ORDER_STATUS_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Jatuh tempo" className="sm:col-span-2">
              <input
                className="field"
                type="date"
                value={payForm.dueDate}
                onChange={(e) => setPayForm({ ...payForm, dueDate: e.target.value })}
              />
            </Field>
            <button
              type="button"
              className="btn btn-ghost sm:col-span-2"
              onClick={() => setPayForm({ ...payForm, paidAmount: String(payForm.order.totalAmount) })}
            >
              Tandai lunas
            </button>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
