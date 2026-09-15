import { desc, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  backups,
  customers,
  orderItems,
  orders,
  products,
  stockMovements,
  wasteRecords,
} from "@/db/schema";

export type BackupSnapshot = {
  version: number;
  generatedAt: string;
  counts: Record<string, number>;
  products: unknown[];
  customers: unknown[];
  orders: unknown[];
  orderItems: unknown[];
  wasteRecords: unknown[];
  stockMovements: unknown[];
};

async function buildSnapshot(): Promise<BackupSnapshot> {
  const [productRows, customerRows, orderRows, itemRows, wasteRows, movementRows] = await Promise.all([
    db.select().from(products),
    db.select().from(customers),
    db.select().from(orders),
    db.select().from(orderItems),
    db.select().from(wasteRecords),
    db.select().from(stockMovements),
  ]);
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    counts: {
      products: productRows.length,
      customers: customerRows.length,
      orders: orderRows.length,
      orderItems: itemRows.length,
      wasteRecords: wasteRows.length,
      stockMovements: movementRows.length,
    },
    products: productRows,
    customers: customerRows,
    orders: orderRows,
    orderItems: itemRows,
    wasteRecords: wasteRows,
    stockMovements: movementRows,
  };
}

export async function createBackup(createdBy: string, label: string): Promise<number> {
  const snapshot = await buildSnapshot();
  const serialized = JSON.stringify(snapshot);
  const inserted = await db
    .insert(backups)
    .values({
      label,
      counts: JSON.stringify(snapshot.counts),
      payload: snapshot as unknown as Record<string, unknown>,
      sizeBytes: Buffer.byteLength(serialized, "utf8"),
      createdBy,
    })
    .returning({ id: backups.id });
  return inserted[0].id;
}

/**
 * Cadangan otomatis: dibuat paling banyak sekali setiap 20 jam.
 * Aman dipanggil dari request mana pun (dilindungi advisory lock).
 */
export async function ensureDailyBackup(): Promise<void> {
  try {
    const lock = await db.execute<{ locked: boolean }>(sql`select pg_try_advisory_lock(556677) as locked`);
    const locked = (lock.rows?.[0] as { locked?: boolean } | undefined)?.locked;
    if (!locked) return;
    try {
      const latest = await db.select({ createdAt: backups.createdAt }).from(backups).orderBy(desc(backups.createdAt)).limit(1);
      const last = latest[0]?.createdAt ? new Date(latest[0].createdAt).getTime() : 0;
      if (Date.now() - last < 20 * 60 * 60 * 1000) return;
      await createBackup("sistem", "Cadangan otomatis harian");
    } finally {
      await db.execute(sql`select pg_advisory_unlock(556677)`);
    }
  } catch (error) {
    console.error("[backup]", error);
  }
}

export async function listBackups(limit = 10) {
  return db
    .select({
      id: backups.id,
      label: backups.label,
      counts: backups.counts,
      sizeBytes: backups.sizeBytes,
      createdBy: backups.createdBy,
      createdAt: backups.createdAt,
    })
    .from(backups)
    .orderBy(desc(backups.createdAt))
    .limit(limit);
}
