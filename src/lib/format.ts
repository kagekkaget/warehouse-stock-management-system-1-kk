export const ROLE_BADGE: Record<string, string> = {
  owner: "bg-amber-100 text-amber-800 ring-amber-200",
  manager: "bg-sky-100 text-sky-800 ring-sky-200",
  staff: "bg-slate-100 text-slate-700 ring-slate-200",
};

export function formatRupiah(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

export function formatNumber(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(
    Number.isFinite(n) ? n : 0,
  );
}

/** Tanggal Indonesia: 12 Mei 2026 */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const date = typeof value === "string" ? new Date(`${value.slice(0, 10)}T00:00:00`) : value;
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function todayISO(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60 * 1000).toISOString().slice(0, 10);
}

export function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const target = new Date(`${dateStr.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - start.getTime()) / 86_400_000);
}

export type StockAlert = "expired" | "critical" | "expiring" | "low" | "ok";

export const ALERT_LABEL: Record<StockAlert, string> = {
  expired: "Kedaluwarsa",
  critical: "Stok habis",
  expiring: "Segera kedaluwarsa",
  low: "Stok rendah",
  ok: "Aman",
};

export const ALERT_BADGE: Record<StockAlert, string> = {
  expired: "bg-rose-100 text-rose-700 ring-rose-200",
  critical: "bg-rose-100 text-rose-700 ring-rose-200",
  expiring: "bg-amber-100 text-amber-800 ring-amber-200",
  low: "bg-orange-100 text-orange-800 ring-orange-200",
  ok: "bg-emerald-100 text-emerald-700 ring-emerald-200",
};

export function stockStatus(input: {
  quantity: number;
  minStock: number;
  expiryDate?: string | null;
}): StockAlert {
  const days = daysUntil(input.expiryDate);
  if (days !== null && days < 0) return "expired";
  if (input.quantity <= 0) return "critical";
  if (days !== null && days <= 30) return "expiring";
  if (input.quantity <= input.minStock) return "low";
  return "ok";
}

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  unpaid: "Belum bayar",
  partial: "Bayar sebagian",
  paid: "Lunas",
  overdue: "Jatuh tempo",
};

export const PAYMENT_STATUS_BADGE: Record<string, string> = {
  unpaid: "bg-slate-100 text-slate-700 ring-slate-200",
  partial: "bg-amber-100 text-amber-800 ring-amber-200",
  paid: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  overdue: "bg-rose-100 text-rose-700 ring-rose-200",
};

export const ORDER_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  confirmed: "Terkonfirmasi",
  processing: "Diproses",
  shipped: "Dikirim",
  completed: "Selesai",
  cancelled: "Dibatalkan",
};

export const MOVEMENT_LABEL: Record<string, string> = {
  in: "Barang masuk",
  out: "Barang keluar",
  adjust: "Penyesuaian",
  waste: "Pemborosan",
};

export const WASTE_REASON_LABEL: Record<string, string> = {
  expired: "Kedaluwarsa",
  damaged: "Rusak",
  spoiled: "Busuk / tidak layak",
  lost: "Hilang",
  other: "Lainnya",
};

export const CUSTOMER_TYPE_LABEL: Record<string, string> = {
  retail: "Eceran",
  grosir: "Grosir",
  reseller: "Reseller",
};

/** Tampilkan nilai sel laporan sesuai tipenya (aman dipakai di klien & server). */
export function reportCellText(value: string | number | undefined, type?: string): string {
  if (value === undefined || value === null || value === "") return "-";
  if (type === "currency") return formatRupiah(Number(value));
  if (type === "number") return formatNumber(Number(value));
  if (type === "date") return formatDate(String(value));
  return String(value);
}

export function csvEscape(value: unknown): string {
  const raw = value === null || value === undefined ? "" : String(value);
  if (/[",\n;]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}
