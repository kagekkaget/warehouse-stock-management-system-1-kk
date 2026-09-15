import { eq } from "drizzle-orm";
import { db } from "@/db";
import { backups } from "@/db/schema";
import { fail, handleRoute, intId, requireUser } from "@/lib/http";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  return handleRoute(async () => {
    await requireUser("user.manage");
    const { id } = await ctx.params;
    const rows = await db.select().from(backups).where(eq(backups.id, intId(id))).limit(1);
    if (!rows.length) return fail(404, "Cadangan tidak ditemukan.");
    const row = rows[0];
    return new Response(JSON.stringify(row.payload, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="cadangan-${row.id}-${new Date(row.createdAt).toISOString().slice(0, 10)}.json"`,
        "cache-control": "no-store",
      },
    });
  });
}
