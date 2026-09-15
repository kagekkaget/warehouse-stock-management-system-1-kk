import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Peran pengguna:
 * - owner  : pemilik toko (akses penuh, termasuk manajemen pengguna & laporan keuangan)
 * - manager: manajer gudang (kelola stok, pelanggan, pesanan, laporan)
 * - staff  : staf gudang (catat mutasi stok, pesanan, lihat inventaris)
 */
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull().default("staff"),
    phone: text("phone"),
    isActive: boolean("is_active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: serial("id").primaryKey(),
    tokenHash: text("token_hash").notNull(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userAgent: text("user_agent"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_unique").on(table.tokenHash),
    index("sessions_user_idx").on(table.userId),
  ],
);

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    sku: text("sku").notNull(),
    name: text("name").notNull(),
    category: text("category").notNull().default("Umum"),
    unit: text("unit").notNull().default("pcs"),
    quantity: doublePrecision("quantity").notNull().default(0),
    minStock: doublePrecision("min_stock").notNull().default(0),
    costPrice: integer("cost_price").notNull().default(0),
    sellPrice: integer("sell_price").notNull().default(0),
    expiryDate: date("expiry_date"),
    location: text("location"),
    supplier: text("supplier"),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("products_sku_unique").on(table.sku),
    index("products_expiry_idx").on(table.expiryDate),
    index("products_category_idx").on(table.category),
  ],
);

/** type: in (masuk) | out (keluar) | adjust (penyesuaian) | waste (pemborosan) */
export const stockMovements = pgTable(
  "stock_movements",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    productName: text("product_name").notNull(),
    type: text("type").notNull(),
    quantity: doublePrecision("quantity").notNull(),
    balanceAfter: doublePrecision("balance_after").notNull().default(0),
    reference: text("reference"),
    note: text("note"),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    userName: text("user_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("movements_product_idx").on(table.productId),
    index("movements_created_idx").on(table.createdAt),
  ],
);

export const customers = pgTable(
  "customers",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    city: text("city"),
    customerType: text("customer_type").notNull().default("retail"),
    preferences: text("preferences"),
    notes: text("notes"),
    consentMarketing: boolean("consent_marketing").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("customers_name_idx").on(table.name)],
);

/** status: draft | confirmed | processing | shipped | completed | cancelled */
/** paymentStatus: unpaid | partial | paid | overdue */
export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    orderNumber: text("order_number").notNull(),
    customerId: integer("customer_id").references(() => customers.id, { onDelete: "set null" }),
    customerName: text("customer_name"),
    orderDate: date("order_date").notNull(),
    dueDate: date("due_date"),
    status: text("status").notNull().default("confirmed"),
    paymentStatus: text("payment_status").notNull().default("unpaid"),
    paymentMethod: text("payment_method").notNull().default("cash"),
    totalAmount: integer("total_amount").notNull().default(0),
    paidAmount: integer("paid_amount").notNull().default(0),
    notes: text("notes"),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("orders_number_unique").on(table.orderNumber),
    index("orders_customer_idx").on(table.customerId),
    index("orders_date_idx").on(table.orderDate),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
    productName: text("product_name").notNull(),
    quantity: doublePrecision("quantity").notNull().default(1),
    unitPrice: integer("unit_price").notNull().default(0),
    subtotal: integer("subtotal").notNull().default(0),
  },
  (table) => [index("order_items_order_idx").on(table.orderId)],
);

/** reason: expired (kedaluwarsa) | damaged (rusak) | spoiled (busut) | lost (hilang) | other */
export const wasteRecords = pgTable(
  "waste_records",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
    productName: text("product_name").notNull(),
    quantity: doublePrecision("quantity").notNull().default(0),
    unit: text("unit").notNull().default("pcs"),
    reason: text("reason").notNull().default("expired"),
    valueLoss: integer("value_loss").notNull().default(0),
    note: text("note"),
    recordedAt: date("recorded_at").notNull(),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    userName: text("user_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("waste_recorded_idx").on(table.recordedAt)],
);

/** Jejak audit untuk kepatuhan UU PDP No. 27/2022 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    userName: text("user_name"),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    detail: text("detail"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("audit_created_idx").on(table.createdAt)],
);

/** Cadangan otomatis harian (JSON snapshot) untuk pemulihan data. */
export const backups = pgTable(
  "backups",
  {
    id: serial("id").primaryKey(),
    label: text("label").notNull(),
    counts: text("counts").notNull().default("{}"),
    payload: jsonb("payload").notNull(),
    sizeBytes: integer("size_bytes").notNull().default(0),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("backups_created_idx").on(table.createdAt)],
);

export type Backup = typeof backups.$inferSelect;
export type User = typeof users.$inferSelect;
export type Product = typeof products.$inferSelect;
export type StockMovement = typeof stockMovements.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type WasteRecord = typeof wasteRecords.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
