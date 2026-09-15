/** Tipe data sisi klien (nilai tanggal sudah berupa string setelah serialisasi JSON). */

export type ProductRow = {
  id: number;
  sku: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  minStock: number;
  costPrice: number;
  sellPrice: number;
  expiryDate: string | null;
  location: string | null;
  supplier: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MovementRow = {
  id: number;
  productId: number;
  productName: string;
  type: "in" | "out" | "adjust" | "waste" | string;
  quantity: number;
  balanceAfter: number;
  reference: string | null;
  note: string | null;
  userName: string | null;
  createdAt: string;
};

export type CustomerRow = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  customerType: string;
  preferences: string | null;
  notes: string | null;
  consentMarketing: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type OrderRow = {
  id: number;
  orderNumber: string;
  customerId: number | null;
  customerName: string | null;
  orderDate: string;
  dueDate: string | null;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  totalAmount: number;
  paidAmount: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OrderItemRow = {
  id: number;
  orderId: number;
  productId: number | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
};

export type WasteRow = {
  id: number;
  productId: number | null;
  productName: string;
  quantity: number;
  unit: string;
  reason: string;
  valueLoss: number;
  note: string | null;
  recordedAt: string;
  userName: string | null;
  createdAt: string;
};

export type UserRow = {
  id: number;
  name: string;
  email: string;
  role: string;
  phone: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

export type BackupRow = {
  id: number;
  label: string;
  counts: string;
  sizeBytes: number;
  createdBy: string | null;
  createdAt: string;
};

export type AuditRow = {
  id: number;
  userId: number | null;
  userName: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  detail: string | null;
  createdAt: string;
};

export type SummaryResponse = {
  inventory: { totalProducts: number; totalUnits: number; stockValue: number; retailValue: number };
  salesToday: { count: number; revenue: number };
  salesMonth: { count: number; revenue: number; collected: number };
  receivable: { amount: number; count: number };
  wasteMonth: { value: number; count: number; units: number };
  customers: number;
  alerts: { lowStock: number; expiring: number; expired: number; potentialLoss: number; expiredLoss: number };
  trend: Array<{ day: string; revenue: number; count: number }>;
  wasteByReason: Array<{ reason: string; value: number; count: number }>;
  topProducts: Array<{ productName: string; quantity: number; revenue: number }>;
  recentMovements: MovementRow[];
};

export type ReportColumn = { key: string; label: string; type?: "text" | "number" | "currency" | "date" };
export type ReportRow = Record<string, string | number>;
export type ReportResponse = {
  report: {
    id: string;
    title: string;
    description: string;
    period: string;
    columns: ReportColumn[];
    rows: ReportRow[];
    summary: Array<{ label: string; value: number; type: "currency" | "number" }>;
  };
};
