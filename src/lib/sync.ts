import { can, type Capability } from "@/lib/permissions";
import type { SessionUser } from "@/lib/auth";
import { ApiError } from "@/lib/http";
import {
  createCustomer,
  createMovement,
  createOrder,
  createProduct,
  createWaste,
  deleteCustomer,
  deleteOrder,
  deleteProduct,
  updateCustomer,
  updateOrder,
  updateProduct,
  type CustomerInput,
  type OrderInput,
  type ProductInput,
} from "@/lib/services";

export type SyncOperation = {
  id: string;
  method: string;
  path: string;
  body?: unknown;
};

export type SyncResult = {
  id: string;
  ok: boolean;
  status: number;
  error?: string;
  data?: unknown;
};

function assertCap(user: SessionUser, capability: Capability): void {
  if (!can(user.role, capability)) throw new ApiError(403, "Anda tidak memiliki izin untuk aksi ini.");
}

/** Menjalankan ulang operasi yang dibuat saat perangkat offline. */
export async function executeOperation(user: SessionUser, op: SyncOperation): Promise<SyncResult> {
  try {
    const method = op.method.toUpperCase();
    const path = op.path.replace(/^\/api/, "");
    const segments = path.split("/").filter(Boolean); // e.g. ["products", "12"]
    const resource = segments[0] ?? "";
    const rawId = segments[1];
    const id = rawId ? Number(rawId) : NaN;
    const body = (op.body ?? {}) as Record<string, unknown>;
    let data: unknown;

    switch (resource) {
      case "products": {
        if (method === "POST") {
          assertCap(user, "product.create");
          data = { product: await createProduct(user, body as ProductInput) };
        } else if (method === "PATCH") {
          assertCap(user, "product.update");
          data = { product: await updateProduct(user, id, body as ProductInput) };
        } else if (method === "DELETE") {
          assertCap(user, "product.delete");
          await deleteProduct(user, id);
          data = { ok: true };
        } else {
          throw new ApiError(405, "Metode tidak didukung.");
        }
        break;
      }
      case "movements": {
        if (method !== "POST") throw new ApiError(405, "Metode tidak didukung.");
        assertCap(user, "movement.create");
        data = await createMovement(user, body);
        break;
      }
      case "customers": {
        if (method === "POST") {
          assertCap(user, "customer.create");
          data = { customer: await createCustomer(user, body as CustomerInput) };
        } else if (method === "PATCH") {
          assertCap(user, "customer.update");
          data = { customer: await updateCustomer(user, id, body as CustomerInput) };
        } else if (method === "DELETE") {
          assertCap(user, "customer.delete");
          await deleteCustomer(user, id);
          data = { ok: true };
        } else {
          throw new ApiError(405, "Metode tidak didukung.");
        }
        break;
      }
      case "orders": {
        if (method === "POST") {
          assertCap(user, "order.create");
          data = { order: await createOrder(user, body as unknown as OrderInput) };
        } else if (method === "PATCH") {
          assertCap(user, "order.update");
          data = { order: await updateOrder(user, id, body as unknown as OrderInput) };
        } else if (method === "DELETE") {
          assertCap(user, "order.delete");
          await deleteOrder(user, id);
          data = { ok: true };
        } else {
          throw new ApiError(405, "Metode tidak didukung.");
        }
        break;
      }
      case "waste": {
        if (method !== "POST") throw new ApiError(405, "Metode tidak didukung.");
        assertCap(user, "waste.create");
        data = { record: await createWaste(user, body) };
        break;
      }
      default:
        throw new ApiError(404, `Operasi ${op.path} tidak dikenal.`);
    }

    if (!Number.isInteger(id) && (method === "PATCH" || method === "DELETE")) {
      throw new ApiError(400, "ID tidak valid pada operasi sinkronisasi.");
    }

    return { id: op.id, ok: true, status: 200, data };
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Gagal menyinkronkan operasi.";
    return { id: op.id, ok: false, status, error: message };
  }
}
