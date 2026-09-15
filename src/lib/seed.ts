import { sql } from "drizzle-orm";
import { db } from "@/db";
import { customers, products, users } from "@/db/schema";
import { hashPassword, toSessionUser } from "@/lib/auth";
import { createOrder, createProduct, createWaste } from "@/lib/services";

function dayOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const DEMO_PRODUCTS: Array<{
  sku: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  minStock: number;
  costPrice: number;
  sellPrice: number;
  expiryDate: string | null;
  location: string;
  supplier: string;
}> = [
  { sku: "MK-001", name: "Indomie Goreng Spesial", category: "Makanan Instan", unit: "pcs", quantity: 240, minStock: 60, costPrice: 2800, sellPrice: 3500, expiryDate: dayOffset(180), location: "Rak A1", supplier: "PT Indofood" },
  { sku: "MK-002", name: "Sarden Kaleng 155g", category: "Makanan Kaleng", unit: "kaleng", quantity: 42, minStock: 20, costPrice: 8500, sellPrice: 11000, expiryDate: dayOffset(45), location: "Rak A2", supplier: "PT CJ Food" },
  { sku: "MK-003", name: "Susu UHT Full Cream 1L", category: "Minuman", unit: "karton", quantity: 18, minStock: 24, costPrice: 17000, sellPrice: 21500, expiryDate: dayOffset(21), location: "Gudang B1", supplier: "CV Susu Sejahtera" },
  { sku: "MK-004", name: "Yogurt Drink Strawbery 250ml", category: "Minuman", unit: "pcs", quantity: 36, minStock: 15, costPrice: 5200, sellPrice: 7000, expiryDate: dayOffset(9), location: "Chiller B2", supplier: "CV Susu Sejahtera" },
  { sku: "MK-005", name: "Kopi Sachet Kapal Api 10g", category: "Minuman", unit: "box", quantity: 96, minStock: 30, costPrice: 9500, sellPrice: 13000, expiryDate: dayOffset(300), location: "Rak A3", supplier: "PT Santos Jaya" },
  { sku: "MK-006", name: "Teh Celup Melati 25s", category: "Minuman", unit: "box", quantity: 54, minStock: 20, costPrice: 6000, sellPrice: 8500, expiryDate: dayOffset(240), location: "Rak A3", supplier: "PT Sinar Sosro" },
  { sku: "BP-001", name: "Beras Pandan Wangi 5kg", category: "Bahan Pokok", unit: "karung", quantity: 30, minStock: 10, costPrice: 62000, sellPrice: 72000, expiryDate: null, location: "Gudang C1", supplier: "UD Tani Makmur" },
  { sku: "BP-002", name: "Minyak Goreng 2L", category: "Bahan Pokok", unit: "pouch", quantity: 48, minStock: 20, costPrice: 32000, sellPrice: 38000, expiryDate: dayOffset(400), location: "Gudang C2", supplier: "PT Salim Ivomas" },
  { sku: "BP-003", name: "Gula Pasir Premium 1kg", category: "Bahan Pokok", unit: "pack", quantity: 8, minStock: 25, costPrice: 15000, sellPrice: 18000, expiryDate: null, location: "Gudang C2", supplier: "UD Tani Makmur" },
  { sku: "BP-004", name: "Telur Ayam Negeri", category: "Bahan Pokok", unit: "kg", quantity: 24.5, minStock: 10, costPrice: 26000, sellPrice: 31000, expiryDate: dayOffset(14), location: "Chiller B1", supplier: "Peternakan Barokah" },
  { sku: "PR-001", name: "Sabun Mandi Batang 85g", category: "Perawatan Diri", unit: "pcs", quantity: 120, minStock: 40, costPrice: 3200, sellPrice: 4500, expiryDate: dayOffset(500), location: "Rak D1", supplier: "PT Unilever" },
  { sku: "PR-002", name: "Sampo Anti Ketombe 170ml", category: "Perawatan Diri", unit: "botol", quantity: 26, minStock: 12, costPrice: 21000, sellPrice: 28000, expiryDate: dayOffset(365), location: "Rak D1", supplier: "PT Unilever" },
  { sku: "PR-003", name: "Pasta Gigi Herbal 190g", category: "Perawatan Diri", unit: "pcs", quantity: 6, minStock: 15, costPrice: 12500, sellPrice: 16500, expiryDate: dayOffset(280), location: "Rak D2", supplier: "PT Lion Wings" },
  { sku: "KB-001", name: "Deterjen Bubuk 800g", category: "Kebersihan", unit: "pack", quantity: 64, minStock: 20, costPrice: 13500, sellPrice: 17500, expiryDate: dayOffset(420), location: "Rak D3", supplier: "PT Wings Group" },
  { sku: "KB-002", name: "Pembersih Lantai 780ml", category: "Kebersihan", unit: "botol", quantity: 32, minStock: 12, costPrice: 14000, sellPrice: 19000, expiryDate: dayOffset(390), location: "Rak D3", supplier: "PT Wings Group" },
  { sku: "KB-003", name: "Tisu Basah Baby 50s", category: "Kebersihan", unit: "pack", quantity: 20, minStock: 10, costPrice: 9000, sellPrice: 12500, expiryDate: dayOffset(-6), location: "Rak D4", supplier: "PT Softcare" },
  { sku: "SN-001", name: "Biskuit Kelapa 300g", category: "Makanan Instan", unit: "pack", quantity: 44, minStock: 18, costPrice: 8200, sellPrice: 11000, expiryDate: dayOffset(60), location: "Rak A4", supplier: "PT Mayora" },
  { sku: "SN-002", name: "Keripik Singkong Balado 200g", category: "Makanan Instan", unit: "pack", quantity: 15, minStock: 20, costPrice: 9500, sellPrice: 13500, expiryDate: dayOffset(12), location: "Rak A4", supplier: "UD Kripik Ibu Yati" },
];

const DEMO_CUSTOMERS = [
  { name: "Warung Bu Yati", phone: "0812-3344-5566", email: "buyati@mail.com", address: "Jl. Melati No. 12", city: "Bandung", customerType: "reseller", preferences: "Pesanan mingguan tiap Senin, selalu minta kiriman pagi", notes: "Pelanggan sejak 2021", consentMarketing: true },
  { name: "Toko Sembako Jaya", phone: "0857-1122-3344", email: "tokojaya@mail.com", address: "Jl. Kenanga No. 8", city: "Cimahi", customerType: "grosir", preferences: "Harga grosir, pembayaran tempo 14 hari", notes: "Sering ambil beras dan minyak", consentMarketing: true },
  { name: "Ibu Rina (Rumah Tangga)", phone: "0821-9988-7766", email: "rina@mail.com", address: "Perum Griya Asri Blok C4", city: "Bandung", customerType: "retail", preferences: "Suka promo susu dan telur", notes: "Langganan tetap", consentMarketing: false },
  { name: "Kafe Kopi Senja", phone: "0813-2222-1111", email: "kopisenja@mail.com", address: "Jl. Riau No. 45", city: "Bandung", customerType: "reseller", preferences: "Butuh kopi & susu UHT setiap 3 hari, tidak menerima produk mendekati kedaluwarsa", notes: " sensitif terhadap tanggal kedaluwarsa", consentMarketing: true },
  { name: "Kantin SMK Bina Bangsa", phone: "0895-4433-2211", email: "kantin@smkbina.sch.id", address: "Jl. Pendidikan No. 3", city: "Bandung", customerType: "grosir", preferences: "Pesanan bulanan, minta invoice resmi", notes: "Pembayaran tunai di muka", consentMarketing: false },
];

let seedPromise: Promise<void> | null = null;

async function runSeed(): Promise<void> {
  const lock = await db.execute<{ locked: boolean }>(sql`select pg_try_advisory_lock(918273645) as locked`);
  const locked = (lock.rows?.[0] as { locked?: boolean } | undefined)?.locked;
  if (!locked) return;
  try {
    const existing = await db.select({ id: users.id }).from(users).limit(1);
    if (existing.length) return;

    const userRows = await db
      .insert(users)
      .values([
        {
          name: "Budi Santoso",
          email: "owner@tokoberkah.id",
          passwordHash: hashPassword("owner123"),
          role: "owner",
          phone: "0812-1000-0001",
        },
        {
          name: "Siti Rahayu",
          email: "manager@tokoberkah.id",
          passwordHash: hashPassword("manager123"),
          role: "manager",
          phone: "0812-1000-0002",
        },
        {
          name: "Andi Pratama",
          email: "staff@tokoberkah.id",
          passwordHash: hashPassword("staff123"),
          role: "staff",
          phone: "0812-1000-0003",
        },
      ])
      .returning();

    const owner = toSessionUser(userRows[0]);
    const staff = toSessionUser(userRows[2]);

    const productRows = await db
      .insert(products)
      .values(
        DEMO_PRODUCTS.map((p) => ({
          sku: p.sku,
          name: p.name,
          category: p.category,
          unit: p.unit,
          quantity: p.quantity,
          minStock: p.minStock,
          costPrice: p.costPrice,
          sellPrice: p.sellPrice,
          expiryDate: p.expiryDate,
          location: p.location,
          supplier: p.supplier,
          createdBy: owner.id,
        })),
      )
      .returning();
    const bySku = new Map(productRows.map((p) => [p.sku, p]));
    void bySku;

    const customerRows = await db.insert(customers).values(DEMO_CUSTOMERS).returning();
    const customerByName = new Map(customerRows.map((c) => [c.name, c.id]));

    const orderSeeds: Array<{
      customer: string;
      date: string;
      due: string | null;
      method: string;
      paidRatio: number;
      items: Array<{ sku: string; quantity: number }>;
      status: string;
    }> = [
      { customer: "Warung Bu Yati", date: dayOffset(-13), due: null, method: "cash", paidRatio: 1, status: "completed", items: [{ sku: "MK-001", quantity: 24 }, { sku: "MK-005", quantity: 3 }] },
      { customer: "Toko Sembako Jaya", date: dayOffset(-11), due: dayOffset(3), method: "transfer", paidRatio: 0, status: "shipped", items: [{ sku: "BP-001", quantity: 5 }, { sku: "BP-002", quantity: 6 }] },
      { customer: "Kafe Kopi Senja", date: dayOffset(-9), due: null, method: "qris", paidRatio: 1, status: "completed", items: [{ sku: "MK-003", quantity: 4 }, { sku: "MK-005", quantity: 4 }] },
      { customer: "Ibu Rina (Rumah Tangga)", date: dayOffset(-7), due: null, method: "cash", paidRatio: 1, status: "completed", items: [{ sku: "BP-004", quantity: 2 }, { sku: "MK-004", quantity: 3 }] },
      { customer: "Kantin SMK Bina Bangsa", date: dayOffset(-5), due: dayOffset(-1), method: "tempo", paidRatio: 0.4, status: "processing", items: [{ sku: "SN-001", quantity: 12 }, { sku: "MK-006", quantity: 6 }] },
      { customer: "Warung Bu Yati", date: dayOffset(-3), due: dayOffset(11), method: "tempo", paidRatio: 0, status: "confirmed", items: [{ sku: "MK-002", quantity: 8 }, { sku: "BP-003", quantity: 4 }] },
      { customer: "Kafe Kopi Senja", date: dayOffset(-2), due: null, method: "qris", paidRatio: 1, status: "completed", items: [{ sku: "MK-003", quantity: 3 }, { sku: "MK-004", quantity: 6 }] },
      { customer: "Toko Sembako Jaya", date: dayOffset(-1), due: dayOffset(13), method: "transfer", paidRatio: 0.5, status: "confirmed", items: [{ sku: "KB-001", quantity: 10 }, { sku: "KB-002", quantity: 6 }, { sku: "PR-001", quantity: 20 }] },
      { customer: "Ibu Rina (Rumah Tangga)", date: dayOffset(0), due: null, method: "cash", paidRatio: 1, status: "processing", items: [{ sku: "PR-002", quantity: 1 }, { sku: "SN-002", quantity: 2 }] },
    ];

    for (const seed of orderSeeds) {
      const items = seed.items
        .map((item) => {
          const product = bySku.get(item.sku);
          if (!product) return null;
          return { productId: product.id, quantity: item.quantity, unitPrice: product.sellPrice };
        })
        .filter((item): item is { productId: number; quantity: number; unitPrice: number } => item !== null);
      if (!items.length) continue;
      const order = await createOrder(owner, {
        customerId: customerByName.get(seed.customer) ?? null,
        orderDate: seed.date,
        dueDate: seed.due,
        status: seed.status,
        paymentMethod: seed.method,
        paidAmount: Math.round(items.reduce((s, i) => s + i.quantity * i.unitPrice, 0) * seed.paidRatio),
        items,
      });
      void order;
    }

    const wasteSeeds: Array<{ sku: string; quantity: number; reason: string; date: string; note: string }> = [
      { sku: "KB-003", quantity: 6, reason: "expired", date: dayOffset(-4), note: "Lewat tanggal kedaluwarsa, tidak terjual" },
      { sku: "MK-004", quantity: 4, reason: "spoiled", date: dayOffset(-8), note: "Rantai dingin mati 1 malam" },
      { sku: "SN-002", quantity: 3, reason: "damaged", date: dayOffset(-12), note: "Kemasan penyok saat pengiriman" },
      { sku: "BP-004", quantity: 1.5, reason: "spoiled", date: dayOffset(-16), note: "Telur pecah di dalam kardus" },
    ];
    for (const seed of wasteSeeds) {
      const product = bySku.get(seed.sku);
      if (!product) continue;
      await createWaste(staff, {
        productId: product.id,
        quantity: seed.quantity,
        reason: seed.reason,
        note: seed.note,
        recordedAt: seed.date,
      });
    }
  } finally {
    await db.execute(sql`select pg_advisory_unlock(918273645)`);
  }
}

/** Idempotent: hanya mengisi data contoh saat database masih kosong. */
export function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = runSeed().catch((error) => {
      seedPromise = null;
      console.error("[seed]", error);
    });
  }
  return seedPromise;
}
