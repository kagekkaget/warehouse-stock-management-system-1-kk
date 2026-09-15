import { asc } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { ApiError, handleRoute, ok, readJson, requireUser } from "@/lib/http";
import { recordAudit } from "@/lib/services";

export const dynamic = "force-dynamic";

const ROLES = ["owner", "manager", "staff"];

export async function GET() {
  return handleRoute(async () => {
    await requireUser("user.manage");
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        phone: users.phone,
        isActive: users.isActive,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(asc(users.id));
    return ok({ items: rows });
  });
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser("user.manage");
    const body = await readJson<Record<string, unknown>>(request);
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const role = String(body.role ?? "staff");
    if (!name || !email) throw new ApiError(400, "Nama dan email wajib diisi.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ApiError(400, "Format email tidak valid.");
    if (password.length < 8) throw new ApiError(400, "Kata sandi minimal 8 karakter.");
    if (!ROLES.includes(role)) throw new ApiError(400, "Peran tidak valid.");

    const inserted = await db
      .insert(users)
      .values({
        name,
        email,
        passwordHash: hashPassword(password),
        role,
        phone: String(body.phone ?? "").trim() || null,
      })
      .returning();
    await recordAudit(user, "create", "user", inserted[0].id, `${name} (${role})`);
    const { passwordHash: _omit, ...safe } = inserted[0];
    void _omit;
    return ok({ user: safe }, { status: 201 });
  });
}
