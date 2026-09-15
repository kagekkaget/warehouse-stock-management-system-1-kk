import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, findUserByEmail, toSessionUser, verifyPassword } from "@/lib/auth";
import { fail, handleRoute, ok, readJson } from "@/lib/http";
import { ensureSeeded } from "@/lib/seed";
import { recordAudit } from "@/lib/services";

export const dynamic = "force-dynamic";

type Attempt = { count: number; first: number };
const attempts = new Map<string, Attempt>();
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 10 * 60 * 1000;

function rateLimited(key: string): boolean {
  const now = Date.now();
  const record = attempts.get(key);
  if (!record || now - record.first > WINDOW_MS) {
    attempts.set(key, { count: 1, first: now });
    return false;
  }
  record.count += 1;
  return record.count > MAX_ATTEMPTS;
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    await ensureSeeded();
    const body = await readJson<{ email?: string; password?: string }>(request);
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    if (!email || !password) return fail(400, "Email dan kata sandi wajib diisi.");

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "lokal";
    if (rateLimited(`${ip}:${email}`)) {
      return fail(429, "Terlalu banyak percobaan masuk. Coba lagi dalam 10 menit.");
    }

    const user = await findUserByEmail(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return fail(401, "Email atau kata sandi salah.");
    }
    if (!user.isActive) return fail(403, "Akun Anda dinonaktifkan. Hubungi pemilik toko.");

    await createSession(user.id, request.headers.get("user-agent"));
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
    const sessionUser = toSessionUser(user);
    await recordAudit(sessionUser, "login", "user", user.id, `Masuk dari ${ip}`);
    return ok({ user: sessionUser });
  });
}
