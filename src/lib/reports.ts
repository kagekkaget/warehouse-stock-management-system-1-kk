import { and, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders, products, wasteRecords } from "@/db/schema";
import { daysUntil, stockStatus, todayISO, WASTE_REASON_LABEL } from "@/lib/format";

export type ReportColumn = {
  key: string;
  label: string;
  type?: "text" | "number" | "currency" | "date";
};

export type ReportSummary = { label: string; value: number; type: "currency" | "number" };

export type ReportData = {
  id: string;
  title: string;
  description: string;
  period: string;
  columns: ReportColumn[];
  rows: Record<string, string | number>[];
  summary: ReportSummary[];
};

export type ReportType = "inventaris" | "penjualan" | "pemborosan";

export function defaultRange(type: ReportType): { from: string; to: string } {
  const to = todayISO();
  if (type === "inventaris") {
    return { from: "", to };
  }
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: from.toISOString().slice(0, 10), to };
}

export async function buildInventoryReport(filter: {
  category?: string;
  status?: string;
}): Promise<ReportData> {
  const conditions: SQL[] = [];
  if (filter.category && filter.category !== "semua") conditions.push(eq(products.category, filter.category));
  const rows = await db
    .select()
    .from(products)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(products.category, products.name);

  const filtered = filter.status && filter.status !== "semua"
    ? rows.filter((row) => stockStatus(row) === filter.status)
    : rows;

  const data = filtered.map((p) => {
    const status = stockStatus(p);
    const days = daysUntil(p.expiryDate);
    return {
      sku: p.sku,
      name: p.name,
      category: p.category,
      unit: p.unit,
      quantity: p.quantity,
      minStock: p.minStock,
      costPrice: p.costPrice,
      sellPrice: p.sellPrice,
      stockValue: Math.round(p.quantity * p.costPrice),
      expiryDate: p.expiryDate ?? "",
      daysLeft: days ?? "",
      status,
    };
  });

  const totalValue = data.reduce((s, r) => s + Number(r.stockValue), 0);
  const totalUnits = data.reduce((s, r) => s + Number(r.quantity), 0);
  const lowStock = data.filter((r) => r.status === "low" || r.status === "critical").length;
  const expiring = data.filter((r) => r.status === "expiring" || r.status === "expired").length;

  return {
    id: "inventaris",
    title: "Laporan Tingkat Inventaris",
    description: "Posisi stok gudang terkini beserta nilai persediaan dan status peringatan.",
    period: `Per ${todayISO()}`,
    columns: [
      { key: "sku", label: "SKU" },
      { key: "name", label: "Nama Produk" },
      { key: "category", label: "Kategori" },
      { key: "quantity", label: "Stok", type: "number" },
      { key: "unit", label: "Satuan" },
      { key: "minStock", label: "Stok Min.", type: "number" },
      { key: "costPrice", label: "Harga Beli", type: "currency" },
      { key: "sellPrice", label: "Harga Jual", type: "currency" },
      { key: "stockValue", label: "Nilai Stok", type: "currency" },
      { key: "expiryDate", label: "Kedaluwarsa", type: "date" },
      { key: "daysLeft", label: "Sisa Hari", type: "number" },
      { key: "status", label: "Status" },
    ],
    rows: data,
    summary: [
      { label: "Jumlah SKU", value: data.length, type: "number" },
      { label: "Total Unit", value: totalUnits, type: "number" },
      { label: "Nilai Persediaan", value: totalValue, type: "currency" },
      { label: "SKU Stok Rendah", value: lowStock, type: "number" },
      { label: "SKU Terancam Kedaluwarsa", value: expiring, type: "number" },
    ],
  };
}

export async function buildSalesReport(from: string, to: string): Promise<ReportData> {
  const conditions: SQL[] = [];
  if (from) conditions.push(gte(orders.orderDate, from));
  if (to) conditions.push(lte(orders.orderDate, to));
  const orderRows = await db
    .select()
    .from(orders)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(orders.orderDate));

  const active = orderRows.filter((o) => o.status !== "cancelled");
  const itemRows = await db
    .select({
      productName: orderItems.productName,
      quantity: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::float8`,
      revenue: sql<number>`coalesce(sum(${orderItems.subtotal}), 0)::bigint`,
      cogs: sql<number>`coalesce(sum(${orderItems.quantity} * coalesce(${products.costPrice}, 0)), 0)::bigint`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .leftJoin(products, eq(products.id, orderItems.productId))
    .where(conditions.length ? and(...conditions) : undefined)
    .groupBy(orderItems.productName)
    .orderBy(desc(sql`sum(${orderItems.subtotal})`));

  const revenue = active.reduce((s, o) => s + o.totalAmount, 0);
  const collected = active.reduce((s, o) => s + o.paidAmount, 0);
  const outstanding = Math.max(0, revenue - collected);
  const cogs = itemRows.reduce((s, r) => s + Number(r.cogs), 0);
  const profit = revenue - cogs;

  return {
    id: "penjualan",
    title: "Laporan Penjualan",
    description: "Rekap pesanan, pembayaran, dan margin kotor pada periode terpilih.",
    period: `${from || "awal"} s.d. ${to || todayISO()}`,
    columns: [
      { key: "orderNumber", label: "No. Pesanan" },
      { key: "orderDate", label: "Tanggal", type: "date" },
      { key: "customerName", label: "Pelanggan" },
      { key: "status", label: "Status" },
      { key: "paymentStatus", label: "Status Bayar" },
      { key: "totalAmount", label: "Total", type: "currency" },
      { key: "paidAmount", label: "Dibayar", type: "currency" },
      { key: "outstanding", label: "Piutang", type: "currency" },
    ],
    rows: orderRows.map((o) => ({
      orderNumber: o.orderNumber,
      orderDate: o.orderDate,
      customerName: o.customerName ?? "Pelanggan umum",
      status: o.status,
      paymentStatus: o.paymentStatus,
      totalAmount: o.totalAmount,
      paidAmount: o.paidAmount,
      outstanding: Math.max(0, o.totalAmount - o.paidAmount),
    })),
    summary: [
      { label: "Jumlah Pesanan", value: active.length, type: "number" },
      { label: "Total Penjualan", value: revenue, type: "currency" },
      { label: "Sudah Diterima", value: collected, type: "currency" },
      { label: "Piutang Belum Tertagih", value: outstanding, type: "currency" },
      { label: "HPP", value: cogs, type: "currency" },
      { label: "Margin Kotor", value: profit, type: "currency" },
    ],
  };
}

export async function buildWasteReport(from: string, to: string): Promise<ReportData> {
  const conditions: SQL[] = [];
  if (from) conditions.push(gte(wasteRecords.recordedAt, from));
  if (to) conditions.push(lte(wasteRecords.recordedAt, to));
  const rows = await db
    .select()
    .from(wasteRecords)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(wasteRecords.recordedAt));

  const totalLoss = rows.reduce((s, r) => s + r.valueLoss, 0);
  const totalUnits = rows.reduce((s, r) => s + r.quantity, 0);
  const byReason = new Map<string, number>();
  for (const row of rows) byReason.set(row.reason, (byReason.get(row.reason) ?? 0) + row.valueLoss);
  const topReason = [...byReason.entries()].sort((a, b) => b[1] - a[1])[0];

  return {
    id: "pemborosan",
    title: "Laporan Pemborosan Stok",
    description: "Barang kedaluwarsa, rusak, atau hilang yang menyebabkan kerugian.",
    period: `${from || "awal"} s.d. ${to || todayISO()}`,
    columns: [
      { key: "recordedAt", label: "Tanggal", type: "date" },
      { key: "productName", label: "Produk" },
      { key: "quantity", label: "Jumlah", type: "number" },
      { key: "unit", label: "Satuan" },
      { key: "reason", label: "Penyebab" },
      { key: "valueLoss", label: "Kerugian", type: "currency" },
      { key: "userName", label: "Dicatat Oleh" },
      { key: "note", label: "Catatan" },
    ],
    rows: rows.map((r) => ({
      recordedAt: r.recordedAt,
      productName: r.productName,
      quantity: r.quantity,
      unit: r.unit,
      reason: WASTE_REASON_LABEL[r.reason] ?? r.reason,
      valueLoss: r.valueLoss,
      userName: r.userName ?? "-",
      note: r.note ?? "",
    })),
    summary: [
      { label: "Jumlah Kejadian", value: rows.length, type: "number" },
      { label: "Total Unit Terbuang", value: totalUnits, type: "number" },
      { label: "Total Kerugian", value: totalLoss, type: "currency" },
      { label: "Jenis Penyebab", value: byReason.size, type: "number" },
    ],
  };
}

export async function buildReport(
  type: ReportType,
  params: { from?: string; to?: string; category?: string; status?: string },
): Promise<ReportData> {
  if (type === "penjualan") return buildSalesReport(params.from ?? "", params.to ?? "");
  if (type === "pemborosan") return buildWasteReport(params.from ?? "", params.to ?? "");
  return buildInventoryReport({ category: params.category, status: params.status });
}
