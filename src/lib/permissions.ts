import type { Role } from "@/lib/auth";

export type Capability =
  | "product.view"
  | "product.create"
  | "product.update"
  | "product.delete"
  | "movement.view"
  | "movement.create"
  | "customer.view"
  | "customer.create"
  | "customer.update"
  | "customer.delete"
  | "order.view"
  | "order.create"
  | "order.update"
  | "order.delete"
  | "waste.view"
  | "waste.create"
  | "report.financial"
  | "report.operational"
  | "user.manage"
  | "audit.view";

const MATRIX: Record<Role, Capability[]> = {
  owner: [
    "product.view",
    "product.create",
    "product.update",
    "product.delete",
    "movement.view",
    "movement.create",
    "customer.view",
    "customer.create",
    "customer.update",
    "customer.delete",
    "order.view",
    "order.create",
    "order.update",
    "order.delete",
    "waste.view",
    "waste.create",
    "report.financial",
    "report.operational",
    "user.manage",
    "audit.view",
  ],
  manager: [
    "product.view",
    "product.create",
    "product.update",
    "movement.view",
    "movement.create",
    "customer.view",
    "customer.create",
    "customer.update",
    "order.view",
    "order.create",
    "order.update",
    "waste.view",
    "waste.create",
    "report.financial",
    "report.operational",
  ],
  staff: [
    "product.view",
    "product.create",
    "product.update",
    "movement.view",
    "movement.create",
    "customer.view",
    "customer.create",
    "order.view",
    "order.create",
    "order.update",
    "waste.view",
    "waste.create",
    "report.operational",
  ],
};

export function can(role: Role | undefined | null, capability: Capability): boolean {
  if (!role) return false;
  return MATRIX[role]?.includes(capability) ?? false;
}

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Pemilik",
  manager: "Manajer",
  staff: "Staf Gudang",
};
