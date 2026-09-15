import { db } from "@/db";
import { customers, orders, products, wasteRecords } from "@/db/schema";
import { handleRoute, requireUser } from "@/lib/http";
import { recordAudit } from "@/lib/services";

export const dynamic = "force-dynamic";

/** Cadangan data lengkap (JSON) — bagian dari strategi pemulihan bencana. */
export async function GET() {
  return handleRoute(async () => {
    const user = await requireUser("user.manage");
    const [productRows, customerRows, orderRows, wasteRows] = await Promise.all([
      db.select().from(products),
      db.select().from(customers),
      db.select().from(orders),
      db.select().from(wasteRecords),
    ]);
    await recordAudit(user, "export", "system", null, "Unduh cadangan data lengkap");
    const payload = {
      generatedAt: new Date().toISOString(),
      version: 1,
      counts: {
        products: productRows.length,
        customers: customerRows.length,
        orders: orderRows.length,
        wasteRecords: wasteRows.length,
      },
      products: productRows,
      customers: customerRows,
      orders: orderRows,
      wasteRecords: wasteRows,
    };
    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="cadangan-gudang-${new Date().toISOString().slice(0, 10)}.json"`,
        "cache-control": "no-store",
      },
    });
  });
}
