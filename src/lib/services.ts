import { and, asc, desc, eq, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLogs,
  customers,
  orderItems,
  orders,
  products,
  stockMovements,
  wasteRecords,
  type Customer,
  type Order,
  type Product,
} from "@/db/schema";
import { ApiError } from "@/lib/http";
import type { SessionUser } from "@/lib/auth";
import { daysUntil, todayISO } from "@/lib/format";

export async function recordAudit(
  user: SessionUser | null,
  action: string,
  entity: string,
  entityId: string | number | null,
  detail?: string,
): Promise<void> {
  await db.insert(auditLogs).values({
    userId: user?.id ?? null,
    userName: user?.name ?? "sistem",
    action,
    entity,
    entityId: entityId === null ? null : String(entityId),
    detail: detail?.slice(0, 500) ?? null,
  });
}

/* ---------------------------------- Produk --------------------------------- */

export type ProductFilter = { search?: string; category?: string; status?: string };

export async function listProducts(filter: ProductFilter = {}): Promise<Product[]> {
  const conditions: SQL[] = [];
  if (filter.search) {
    const term = `%${filter.search}%`;
    const clause = or(ilike(products.name, term), ilike(products.sku, term), ilike(products.supplier, term));
    if (clause) conditions.push(clause);
  }
  if (filter.category && filter.category !== "semua") {
    conditions.push(eq(products.category, filter.category));
  }
  const rows = await db
    .select()
    .from(products)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(products.name))
    .limit(500);
  if (!filter.status || filter.status === "semua") return rows;
  return rows.filter((row) => {
    const days = daysUntil(row.expiryDate);
    if (filter.status === "expired") return days !== null && days < 0;
    if (filter.status === "expiring") return days !== null && days >= 0 && days <= 30;
    if (filter.status === "low") return row.quantity > 0 && row.quantity <= row.minStock;
    if (filter.status === "out") return row.quantity <= 0;
    if (filter.status === "ok") return row.quantity > row.minStock && (days === null || days > 30);
    return true;
  });
}

export async function listCategories(): Promise<string[]> {
  const rows = await db
    .select({ category: products.category })
    .from(products)
    .groupBy(products.category)
    .orderBy(asc(products.category));
  return rows.map((r) => r.category);
}

export type ProductInput = {
  sku?: unknown;
  name?: unknown;
  category?: unknown;
  unit?: unknown;
  quantity?: unknown;
  minStock?: unknown;
  costPrice?: unknown;
  sellPrice?: unknown;
  expiryDate?: unknown;
  location?: unknown;
  supplier?: unknown;
  notes?: unknown;
};

function requireText(value: unknown, field: string): string {
  const text = String(value ?? "").trim();
  if (!text) throw new ApiError(400, `Kolom ${field} wajib diisi.`);
  return text;
}

function optionalNumber(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function optionalDate(value: unknown): string | null {
  if (!value) return null;
  const text = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

export async function createProduct(user: SessionUser, input: ProductInput): Promise<Product> {
  const name = requireText(input.name, "nama produk");
  let sku = String(input.sku ?? "").trim();
  if (!sku) sku = `SKU-${Date.now().toString().slice(-8)}`;
  const existing = await db.select({ id: products.id }).from(products).where(eq(products.sku, sku)).limit(1);
  if (existing.length) throw new ApiError(409, `SKU ${sku} sudah digunakan.`);

  const quantity = optionalNumber(input.quantity, 0);
  const created = await db
    .insert(products)
    .values({
      sku,
      name,
      category: String(input.category ?? "Umum").trim() || "Umum",
      unit: String(input.unit ?? "pcs").trim() || "pcs",
      quantity,
      minStock: optionalNumber(input.minStock, 0),
      costPrice: Math.round(optionalNumber(input.costPrice, 0)),
      sellPrice: Math.round(optionalNumber(input.sellPrice, 0)),
      expiryDate: optionalDate(input.expiryDate),
      location: String(input.location ?? "").trim() || null,
      supplier: String(input.supplier ?? "").trim() || null,
      notes: String(input.notes ?? "").trim() || null,
      createdBy: user.id,
    })
    .returning();
  const product = created[0];
  if (quantity > 0) {
    await db.insert(stockMovements).values({
      productId: product.id,
      productName: product.name,
      type: "in",
      quantity,
      balanceAfter: quantity,
      reference: "Stok awal",
      note: "Penambahan produk baru",
      userId: user.id,
      userName: user.name,
    });
  }
  await recordAudit(user, "create", "product", product.id, `${product.name} (${product.sku})`);
  return product;
}

export async function updateProduct(
  user: SessionUser,
  id: number,
  input: ProductInput,
): Promise<Product> {
  const current = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!current.length) throw new ApiError(404, "Produk tidak ditemukan.");
  const before = current[0];
  const quantity = optionalNumber(input.quantity, before.quantity);

  const updated = await db
    .update(products)
    .set({
      sku: input.sku === undefined ? before.sku : String(input.sku).trim() || before.sku,
      name: input.name === undefined ? before.name : requireText(input.name, "nama produk"),
      category: input.category === undefined ? before.category : String(input.category).trim() || before.category,
      unit: input.unit === undefined ? before.unit : String(input.unit).trim() || before.unit,
      quantity,
      minStock: input.minStock === undefined ? before.minStock : optionalNumber(input.minStock, before.minStock),
      costPrice: input.costPrice === undefined ? before.costPrice : Math.round(optionalNumber(input.costPrice, before.costPrice)),
      sellPrice: input.sellPrice === undefined ? before.sellPrice : Math.round(optionalNumber(input.sellPrice, before.sellPrice)),
      expiryDate: input.expiryDate === undefined ? before.expiryDate : optionalDate(input.expiryDate),
      location: input.location === undefined ? before.location : String(input.location).trim() || null,
      supplier: input.supplier === undefined ? before.supplier : String(input.supplier).trim() || null,
      notes: input.notes === undefined ? before.notes : String(input.notes).trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(products.id, id))
    .returning();
  const product = updated[0];
  const delta = quantity - before.quantity;
  if (delta !== 0) {
    await db.insert(stockMovements).values({
      productId: product.id,
      productName: product.name,
      type: "adjust",
      quantity: Math.abs(delta),
      balanceAfter: quantity,
      reference: "Edit produk",
      note: delta > 0 ? `Penambahan manual ${delta}` : `Pengurangan manual ${Math.abs(delta)}`,
      userId: user.id,
      userName: user.name,
    });
  }
  await recordAudit(user, "update", "product", product.id, `${product.name} (${product.sku})`);
  return product;
}

export async function deleteProduct(user: SessionUser, id: number): Promise<void> {
  const current = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!current.length) throw new ApiError(404, "Produk tidak ditemukan.");
  await db.delete(products).where(eq(products.id, id));
  await recordAudit(user, "delete", "product", id, current[0].name);
}

/* ------------------------------- Mutasi stok ------------------------------- */

export async function listMovements(limit = 100, productId?: number) {
  return db
    .select()
    .from(stockMovements)
    .where(productId ? eq(stockMovements.productId, productId) : undefined)
    .orderBy(desc(stockMovements.createdAt), desc(stockMovements.id))
    .limit(Math.min(limit, 500));
}

export async function createMovement(
  user: SessionUser,
  input: {
    productId?: unknown;
    type?: unknown;
    quantity?: unknown;
    reference?: unknown;
    note?: unknown;
  },
): Promise<{ movement: typeof stockMovements.$inferSelect; product: Product }> {
  const productId = Number(input.productId);
  if (!Number.isInteger(productId) || productId <= 0) throw new ApiError(400, "Pilih produk terlebih dahulu.");
  const type = String(input.type ?? "in");
  if (!["in", "out", "adjust"].includes(type)) throw new ApiError(400, "Jenis mutasi tidak valid.");
  const quantity = Number(input.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) throw new ApiError(400, "Jumlah harus lebih dari 0.");

  const rows = await db.select().from(products).where(eq(products.id, productId)).limit(1);
  if (!rows.length) throw new ApiError(404, "Produk tidak ditemukan.");
  const product = rows[0];
  let nextQty = product.quantity;
  if (type === "in") nextQty = product.quantity + quantity;
  else nextQty = product.quantity - quantity;
  if (type === "adjust") nextQty = quantity; // penyesuaian stok opname
  if (nextQty < 0) throw new ApiError(400, `Stok tidak cukup. Stok ${product.name} saat ini ${product.quantity}.`);

  const updated = await db
    .update(products)
    .set({ quantity: nextQty, updatedAt: new Date() })
    .where(eq(products.id, productId))
    .returning();
  const inserted = await db
    .insert(stockMovements)
    .values({
      productId,
      productName: product.name,
      type,
      quantity,
      balanceAfter: nextQty,
      reference: String(input.reference ?? "").trim() || null,
      note: String(input.note ?? "").trim() || null,
      userId: user.id,
      userName: user.name,
    })
    .returning();
  await recordAudit(user, "movement", "product", productId, `${type} ${quantity} ${product.unit} — ${product.name}`);
  return { movement: inserted[0], product: updated[0] };
}

/* -------------------------------- Pelanggan -------------------------------- */

export async function listCustomers(search?: string): Promise<Customer[]> {
  const term = search ? `%${search}%` : null;
  const clause = term
    ? or(ilike(customers.name, term), ilike(customers.phone, term), ilike(customers.email, term), ilike(customers.city, term))
    : undefined;
  return db
    .select()
    .from(customers)
    .where(clause)
    .orderBy(asc(customers.name))
    .limit(500);
}

export type CustomerInput = Record<string, unknown>;

function customerValues(input: CustomerInput, partial: Customer | null) {
  return {
    name: requireText(input.name ?? partial?.name, "nama pelanggan"),
    phone: String(input.phone ?? partial?.phone ?? "").trim() || null,
    email: String(input.email ?? partial?.email ?? "").trim() || null,
    address: String(input.address ?? partial?.address ?? "").trim() || null,
    city: String(input.city ?? partial?.city ?? "").trim() || null,
    customerType: String(input.customerType ?? partial?.customerType ?? "retail"),
    preferences: String(input.preferences ?? partial?.preferences ?? "").trim() || null,
    notes: String(input.notes ?? partial?.notes ?? "").trim() || null,
    consentMarketing: Boolean(input.consentMarketing ?? partial?.consentMarketing ?? false),
    isActive: input.isActive === undefined ? (partial?.isActive ?? true) : Boolean(input.isActive),
    updatedAt: new Date(),
  };
}

export async function createCustomer(user: SessionUser, input: CustomerInput): Promise<Customer> {
  const inserted = await db.insert(customers).values(customerValues(input, null)).returning();
  await recordAudit(user, "create", "customer", inserted[0].id, inserted[0].name);
  return inserted[0];
}

export async function updateCustomer(user: SessionUser, id: number, input: CustomerInput): Promise<Customer> {
  const current = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  if (!current.length) throw new ApiError(404, "Pelanggan tidak ditemukan.");
  const updated = await db
    .update(customers)
    .set(customerValues(input, current[0]))
    .where(eq(customers.id, id))
    .returning();
  await recordAudit(user, "update", "customer", id, updated[0].name);
  return updated[0];
}

export async function deleteCustomer(user: SessionUser, id: number): Promise<void> {
  const current = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  if (!current.length) throw new ApiError(404, "Pelanggan tidak ditemukan.");
  await db.delete(customers).where(eq(customers.id, id));
  await recordAudit(user, "delete", "customer", id, current[0].name);
}

export async function getCustomerDetail(id: number) {
  const rows = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  if (!rows.length) throw new ApiError(404, "Pelanggan tidak ditemukan.");
  const orderList = await db
    .select()
    .from(orders)
    .where(eq(orders.customerId, id))
    .orderBy(desc(orders.orderDate), desc(orders.id))
    .limit(100);
  const totals = orderList.reduce(
    (acc, order) => {
      if (order.status !== "cancelled") {
        acc.totalSpend += order.totalAmount;
        acc.paid += order.paidAmount;
        acc.orderCount += 1;
      }
      return acc;
    },
    { totalSpend: 0, paid: 0, orderCount: 0 },
  );
  return { customer: rows[0], orders: orderList, ...totals, outstanding: Math.max(0, totals.totalSpend - totals.paid) };
}

/* --------------------------------- Pesanan --------------------------------- */

export type OrderInput = {
  customerId?: unknown;
  orderDate?: unknown;
  dueDate?: unknown;
  status?: unknown;
  paymentMethod?: unknown;
  paidAmount?: unknown;
  notes?: unknown;
  items?: unknown;
};

function derivePaymentStatus(total: number, paid: number, dueDate: string | null): string {
  if (paid >= total && total > 0) return "paid";
  if (paid > 0) return "partial";
  if (dueDate && dueDate < todayISO()) return "overdue";
  return "unpaid";
}

export async function listOrders(filter: { search?: string; paymentStatus?: string; from?: string; to?: string } = {}) {
  const conditions: SQL[] = [];
  if (filter.search) {
    const term = `%${filter.search}%`;
    const clause = or(ilike(orders.orderNumber, term), ilike(orders.customerName, term));
    if (clause) conditions.push(clause);
  }
  if (filter.paymentStatus && filter.paymentStatus !== "semua") {
    conditions.push(eq(orders.paymentStatus, filter.paymentStatus));
  }
  if (filter.from) conditions.push(gte(orders.orderDate, filter.from));
  if (filter.to) conditions.push(lte(orders.orderDate, filter.to));
  return db
    .select()
    .from(orders)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(orders.orderDate), desc(orders.id))
    .limit(300);
}

export async function listOrderItems(orderIds: number[]) {
  if (!orderIds.length) return [] as (typeof orderItems.$inferSelect)[];
  return db
    .select()
    .from(orderItems)
    .where(sql`${orderItems.orderId} = any(${sql.raw(`array[${orderIds.join(",")}]`)})`);
}

export async function getOrderDetail(id: number) {
  const rows = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!rows.length) throw new ApiError(404, "Pesanan tidak ditemukan.");
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
  return { order: rows[0], items };
}

async function nextOrderNumber(): Promise<string> {
  const today = todayISO().replace(/-/g, "");
  const rows = await db.select({ count: sql<number>`count(*)::int` }).from(orders);
  const seq = (rows[0]?.count ?? 0) + 1;
  return `PO-${today}-${String(seq).padStart(4, "0")}`;
}

type ItemInput = { productId?: unknown; quantity?: unknown; unitPrice?: unknown };

export async function createOrder(user: SessionUser, input: OrderInput): Promise<Order> {
  const rawItems = Array.isArray(input.items) ? (input.items as ItemInput[]) : [];
  const parsedItems = rawItems
    .map((item) => ({
      productId: Number(item.productId),
      quantity: Number(item.quantity),
      unitPrice: Math.round(Number(item.unitPrice ?? 0)),
    }))
    .filter((item) => Number.isInteger(item.productId) && item.productId > 0 && Number.isFinite(item.quantity) && item.quantity > 0);
  if (!parsedItems.length) throw new ApiError(400, "Pesanan harus memiliki minimal satu item.");

  const productIds = parsedItems.map((i) => i.productId);
  const productRows = await db
    .select()
    .from(products)
    .where(sql`${products.id} = any(${sql.raw(`array[${productIds.join(",")}]`)})`);
  const productMap = new Map(productRows.map((p) => [p.id, p]));

  let total = 0;
  const lineItems = parsedItems.map((item) => {
    const product = productMap.get(item.productId);
    if (!product) throw new ApiError(400, "Salah satu produk tidak ditemukan.");
    const unitPrice = item.unitPrice > 0 ? item.unitPrice : product.sellPrice;
    const subtotal = Math.round(unitPrice * item.quantity);
    total += subtotal;
    return { product, quantity: item.quantity, unitPrice, subtotal };
  });

  let customerName: string | null = null;
  let customerId: number | null = null;
  if (input.customerId !== undefined && input.customerId !== null && String(input.customerId) !== "") {
    customerId = Number(input.customerId);
    const rows = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
    if (!rows.length) throw new ApiError(404, "Pelanggan tidak ditemukan.");
    customerName = rows[0].name;
  }

  const paidAmount = Math.round(optionalNumber(input.paidAmount, 0));
  const orderDate = optionalDate(input.orderDate) ?? todayISO();
  const dueDate = optionalDate(input.dueDate);
  const inserted = await db
    .insert(orders)
    .values({
      orderNumber: await nextOrderNumber(),
      customerId,
      customerName,
      orderDate,
      dueDate,
      status: String(input.status ?? "confirmed"),
      paymentStatus: derivePaymentStatus(total, paidAmount, dueDate),
      paymentMethod: String(input.paymentMethod ?? "cash"),
      totalAmount: total,
      paidAmount: Math.min(paidAmount, total),
      notes: String(input.notes ?? "").trim() || null,
      createdBy: user.id,
    })
    .returning();
  const order = inserted[0];

  for (const line of lineItems) {
    await db.insert(orderItems).values({
      orderId: order.id,
      productId: line.product.id,
      productName: line.product.name,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      subtotal: line.subtotal,
    });
    const nextQty = line.product.quantity - line.quantity;
    await db
      .update(products)
      .set({ quantity: nextQty < 0 ? 0 : nextQty, updatedAt: new Date() })
      .where(eq(products.id, line.product.id));
    await db.insert(stockMovements).values({
      productId: line.product.id,
      productName: line.product.name,
      type: "out",
      quantity: line.quantity,
      balanceAfter: nextQty < 0 ? 0 : nextQty,
      reference: order.orderNumber,
      note: `Penjualan ke ${customerName ?? "pelanggan umum"}`,
      userId: user.id,
      userName: user.name,
    });
  }
  await recordAudit(user, "create", "order", order.id, `${order.orderNumber} — Rp${total}`);
  return order;
}

export async function updateOrder(user: SessionUser, id: number, input: OrderInput): Promise<Order> {
  const current = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!current.length) throw new ApiError(404, "Pesanan tidak ditemukan.");
  const before = current[0];
  const paidAmount = input.paidAmount === undefined ? before.paidAmount : Math.round(optionalNumber(input.paidAmount, 0));
  const totalAmount = before.totalAmount;
  const dueDate = input.dueDate === undefined ? before.dueDate : optionalDate(input.dueDate);
  const updated = await db
    .update(orders)
    .set({
      status: input.status === undefined ? before.status : String(input.status),
      paymentMethod: input.paymentMethod === undefined ? before.paymentMethod : String(input.paymentMethod),
      paidAmount,
      dueDate,
      paymentStatus: derivePaymentStatus(totalAmount, paidAmount, dueDate),
      notes: input.notes === undefined ? before.notes : String(input.notes).trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, id))
    .returning();
  await recordAudit(user, "update", "order", id, `${before.orderNumber} — status bayar ${updated[0].paymentStatus}`);
  return updated[0];
}

export async function deleteOrder(user: SessionUser, id: number): Promise<void> {
  const current = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!current.length) throw new ApiError(404, "Pesanan tidak ditemukan.");
  await db.delete(orders).where(eq(orders.id, id));
  await recordAudit(user, "delete", "order", id, current[0].orderNumber);
}

/* ------------------------------- Pemborosan -------------------------------- */

export async function listWaste(filter: { from?: string; to?: string; reason?: string } = {}) {
  const conditions: SQL[] = [];
  if (filter.from) conditions.push(gte(wasteRecords.recordedAt, filter.from));
  if (filter.to) conditions.push(lte(wasteRecords.recordedAt, filter.to));
  if (filter.reason && filter.reason !== "semua") conditions.push(eq(wasteRecords.reason, filter.reason));
  return db
    .select()
    .from(wasteRecords)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(wasteRecords.recordedAt), desc(wasteRecords.id))
    .limit(500);
}

export async function createWaste(
  user: SessionUser,
  input: { productId?: unknown; quantity?: unknown; reason?: unknown; note?: unknown; recordedAt?: unknown; unit?: unknown },
) {
  const productId = Number(input.productId);
  if (!Number.isInteger(productId) || productId <= 0) throw new ApiError(400, "Pilih produk terlebih dahulu.");
  const quantity = Number(input.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) throw new ApiError(400, "Jumlah harus lebih dari 0.");
  const rows = await db.select().from(products).where(eq(products.id, productId)).limit(1);
  if (!rows.length) throw new ApiError(404, "Produk tidak ditemukan.");
  const product = rows[0];
  if (quantity > product.quantity) {
    throw new ApiError(400, `Jumlah melebihi stok tersedia (${product.quantity} ${product.unit}).`);
  }
  const reason = String(input.reason ?? "expired");
  const valueLoss = Math.round(quantity * product.costPrice);
  const nextQty = product.quantity - quantity;
  await db.update(products).set({ quantity: nextQty, updatedAt: new Date() }).where(eq(products.id, productId));
  await db.insert(stockMovements).values({
    productId,
    productName: product.name,
    type: "waste",
    quantity,
    balanceAfter: nextQty,
    reference: "Catatan pemborosan",
    note: reason,
    userId: user.id,
    userName: user.name,
  });
  const inserted = await db
    .insert(wasteRecords)
    .values({
      productId,
      productName: product.name,
      quantity,
      unit: product.unit,
      reason,
      valueLoss,
      note: String(input.note ?? "").trim() || null,
      recordedAt: optionalDate(input.recordedAt) ?? todayISO(),
      userId: user.id,
      userName: user.name,
    })
    .returning();
  await recordAudit(user, "create", "waste", inserted[0].id, `${product.name} — ${quantity} ${product.unit}`);
  return inserted[0];
}

/* --------------------------- Ringkasan & peringatan ------------------------ */

export async function getAlerts(days = 30) {
  const all = await db.select().from(products).orderBy(asc(products.expiryDate)).limit(500);
  const lowStock = all.filter((p) => p.quantity <= p.minStock);
  const expiring = all.filter((p) => {
    const d = daysUntil(p.expiryDate);
    return d !== null && d >= 0 && d <= days;
  });
  const expired = all.filter((p) => {
    const d = daysUntil(p.expiryDate);
    return d !== null && d < 0;
  });
  const potentialLoss = expiring.reduce((sum, p) => sum + p.quantity * p.costPrice, 0);
  const expiredLoss = expired.reduce((sum, p) => sum + p.quantity * p.costPrice, 0);
  return { lowStock, expiring, expired, potentialLoss, expiredLoss };
}

export async function getSummary() {
  const today = todayISO();
  const monthStart = `${today.slice(0, 7)}-01`;

  const [inventory] = await db
    .select({
      totalProducts: sql<number>`count(*)::int`,
      totalUnits: sql<number>`coalesce(sum(${products.quantity}), 0)::float8`,
      stockValue: sql<number>`coalesce(sum(${products.quantity} * ${products.costPrice}), 0)::bigint`,
      retailValue: sql<number>`coalesce(sum(${products.quantity} * ${products.sellPrice}), 0)::bigint`,
    })
    .from(products);

  const [salesToday] = await db
    .select({
      count: sql<number>`count(*)::int`,
      revenue: sql<number>`coalesce(sum(${orders.totalAmount}), 0)::bigint`,
    })
    .from(orders)
    .where(and(eq(orders.orderDate, today), sql`${orders.status} <> 'cancelled'`));

  const [salesMonth] = await db
    .select({
      count: sql<number>`count(*)::int`,
      revenue: sql<number>`coalesce(sum(${orders.totalAmount}), 0)::bigint`,
      collected: sql<number>`coalesce(sum(${orders.paidAmount}), 0)::bigint`,
    })
    .from(orders)
    .where(and(gte(orders.orderDate, monthStart), sql`${orders.status} <> 'cancelled'`));

  const [receivable] = await db
    .select({
      amount: sql<number>`coalesce(sum(${orders.totalAmount} - ${orders.paidAmount}), 0)::bigint`,
      count: sql<number>`count(*)::int`,
    })
    .from(orders)
    .where(and(sql`${orders.status} <> 'cancelled'`, sql`${orders.totalAmount} > ${orders.paidAmount}`));

  const [wasteMonth] = await db
    .select({
      value: sql<number>`coalesce(sum(${wasteRecords.valueLoss}), 0)::bigint`,
      count: sql<number>`count(*)::int`,
      units: sql<number>`coalesce(sum(${wasteRecords.quantity}), 0)::float8`,
    })
    .from(wasteRecords)
    .where(gte(wasteRecords.recordedAt, monthStart));

  const [customerCount] = await db.select({ count: sql<number>`count(*)::int` }).from(customers);

  const alerts = await getAlerts(30);
  const trend = await db
    .select({
      day: sql<string>`to_char(${orders.orderDate}, 'YYYY-MM-DD')`,
      revenue: sql<number>`coalesce(sum(${orders.totalAmount}), 0)::bigint`,
      count: sql<number>`count(*)::int`,
    })
    .from(orders)
    .where(and(gte(orders.orderDate, sql`${today}::date - interval '13 days'`), sql`${orders.status} <> 'cancelled'`))
    .groupBy(sql`to_char(${orders.orderDate}, 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(${orders.orderDate}, 'YYYY-MM-DD')`);

  const wasteByReason = await db
    .select({
      reason: wasteRecords.reason,
      value: sql<number>`coalesce(sum(${wasteRecords.valueLoss}), 0)::bigint`,
      count: sql<number>`count(*)::int`,
    })
    .from(wasteRecords)
    .where(gte(wasteRecords.recordedAt, monthStart))
    .groupBy(wasteRecords.reason)
    .orderBy(desc(sql`sum(${wasteRecords.valueLoss})`));

  const topProducts = await db
    .select({
      productName: orderItems.productName,
      quantity: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::float8`,
      revenue: sql<number>`coalesce(sum(${orderItems.subtotal}), 0)::bigint`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(and(gte(orders.orderDate, monthStart), sql`${orders.status} <> 'cancelled'`))
    .groupBy(orderItems.productName)
    .orderBy(desc(sql`sum(${orderItems.subtotal})`))
    .limit(5);

  const recentMovements = await listMovements(8);

  return {
    inventory: {
      totalProducts: Number(inventory?.totalProducts ?? 0),
      totalUnits: Number(inventory?.totalUnits ?? 0),
      stockValue: Number(inventory?.stockValue ?? 0),
      retailValue: Number(inventory?.retailValue ?? 0),
    },
    salesToday: { count: Number(salesToday?.count ?? 0), revenue: Number(salesToday?.revenue ?? 0) },
    salesMonth: {
      count: Number(salesMonth?.count ?? 0),
      revenue: Number(salesMonth?.revenue ?? 0),
      collected: Number(salesMonth?.collected ?? 0),
    },
    receivable: { amount: Number(receivable?.amount ?? 0), count: Number(receivable?.count ?? 0) },
    wasteMonth: {
      value: Number(wasteMonth?.value ?? 0),
      count: Number(wasteMonth?.count ?? 0),
      units: Number(wasteMonth?.units ?? 0),
    },
    customers: Number(customerCount?.count ?? 0),
    alerts: {
      lowStock: alerts.lowStock.length,
      expiring: alerts.expiring.length,
      expired: alerts.expired.length,
      potentialLoss: alerts.potentialLoss,
      expiredLoss: alerts.expiredLoss,
    },
    trend: trend.map((t) => ({ day: t.day, revenue: Number(t.revenue), count: Number(t.count) })),
    wasteByReason: wasteByReason.map((w) => ({ reason: w.reason, value: Number(w.value), count: Number(w.count) })),
    topProducts: topProducts.map((p) => ({
      productName: p.productName,
      quantity: Number(p.quantity),
      revenue: Number(p.revenue),
    })),
    recentMovements,
  };
}
