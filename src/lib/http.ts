import { getSessionUser, type Role, type SessionUser } from "@/lib/auth";
import { can, type Capability } from "@/lib/permissions";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function ok<T>(data: T, init?: ResponseInit): Response {
  return Response.json(data as unknown as Record<string, unknown>, {
    ...init,
    headers: { "cache-control": "no-store", ...(init?.headers ?? {}) },
  });
}

export function fail(status: number, message: string): Response {
  return Response.json({ error: message }, { status, headers: { "cache-control": "no-store" } });
}

export async function requireUser(capability?: Capability): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new ApiError(401, "Sesi berakhir. Silakan masuk kembali.");
  if (capability && !can(user.role, capability)) {
    throw new ApiError(403, "Anda tidak memiliki izin untuk aksi ini.");
  }
  return user;
}

export async function requireRole(roles: Role[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new ApiError(401, "Sesi berakhir. Silakan masuk kembali.");
  if (!roles.includes(user.role)) throw new ApiError(403, "Akses ditolak untuk peran Anda.");
  return user;
}

export async function readJson<T = Record<string, unknown>>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new ApiError(400, "Format permintaan tidak valid.");
  }
}

export function handleRoute(handler: () => Promise<Response>): Promise<Response> {
  return handler().catch((error: unknown) => {
    if (error instanceof ApiError) return fail(error.status, error.message);
    console.error("[api-error]", error);
    return fail(500, "Terjadi kesalahan pada server.");
  });
}

export function str(value: unknown, field: string, opts?: { required?: boolean; max?: number }): string | null {
  if (value === undefined || value === null) {
    if (opts?.required) throw new ApiError(400, `Kolom ${field} wajib diisi.`);
    return null;
  }
  const text = String(value).trim();
  if (opts?.required && !text) throw new ApiError(400, `Kolom ${field} wajib diisi.`);
  if (opts?.max && text.length > opts.max) return text.slice(0, opts.max);
  return text;
}

export function num(value: unknown, field: string, opts?: { min?: number; fallback?: number }): number {
  if (value === undefined || value === null || value === "") {
    if (opts?.fallback !== undefined) return opts.fallback;
    throw new ApiError(400, `Kolom ${field} wajib diisi.`);
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new ApiError(400, `Kolom ${field} harus berupa angka.`);
  if (opts?.min !== undefined && parsed < opts.min) {
    throw new ApiError(400, `Kolom ${field} minimal ${opts.min}.`);
  }
  return parsed;
}

export function intId(value: string | undefined, field = "ID"): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new ApiError(400, `${field} tidak valid.`);
  return parsed;
}
