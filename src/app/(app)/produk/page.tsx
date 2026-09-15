import { getSessionUser } from "@/lib/auth";
import ProdukClient from "./produk-client";

export const dynamic = "force-dynamic";

export default async function ProdukPage() {
  const user = await getSessionUser();
  return <ProdukClient role={user?.role ?? "staff"} />;
}
