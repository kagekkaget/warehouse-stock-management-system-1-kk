import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { ApiError, handleRoute, intId, ok, readJson, requireUser } from "@/lib/http";
import { recordAudit } from "@/lib/services";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  return handleRoute(async () => {
    const actor = await requireUser("user.manage");
    const { id } = await ctx.params;
    const userId = intId(id);
    const body = await readJson<Record<string, unknown>>(request);

    const current = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!current.length) throw new ApiError(404, "Pengguna tidak ditemukan.");

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (body.name !== undefined) patch.name = String(body.name).trim();
    if (body.phone !== undefined) patch.phone = String(body.phone).trim() || null;
    if (body.role !== undefined) {
      const role = String(body.role);
      if (!["owner", "manager", "staff"].includes(role)) throw new ApiError(400, "Peran tidak valid.");
      if (current[0].role === "owner" && role !== "owner") {
        const owners = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(users)
          .where(and(eq(users.role, "owner"), eq(users.isActive, true), ne(users.id, userId)));
        if (Number(owners[0]?.count ?? 0) === 0) {
          throw new ApiError(400, "Minimal harus ada satu pemilik aktif.");
        }
      }
      patch.role = role;
    }
    if (body.isActive !== undefined) patch.isActive = Boolean(body.isActive);
    if (body.password !== undefined) {
      const password = String(body.password);
      if (password.length < 8) throw new ApiError(400, "Kata sandi minimal 8 karakter.");
      patch.passwordHash = hashPassword(password);
    }

    const updated = await db.update(users).set(patch).where(eq(users.id, userId)).returning();
    await recordAudit(actor, "update", "user", userId, updated[0].email);
    const { passwordHash: _omit, ...safe } = updated[0];
    void _omit;
    return ok({ user: safe });
  });
}

export async function DELETE(request: Request, ctx: Ctx) {
  return handleRoute(async () => {
    const actor = await requireUser("user.manage");
    const { id } = await ctx.params;
    const userId = intId(id);
    if (userId === actor.id) throw new ApiError(400, "Anda tidak dapat menghapus akun sendiri.");
    const current = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!current.length) throw new ApiError(404, "Pengguna tidak ditemukan.");
    await db.delete(users).where(eq(users.id, userId));
    await recordAudit(actor, "delete", "user", userId, current[0].email);
    return ok({ ok: true });
  });
}
