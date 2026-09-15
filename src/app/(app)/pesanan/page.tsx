import { getSessionUser } from "@/lib/auth";
import PesananClient from "./pesanan-client";

export const dynamic = "force-dynamic";

export default async function PesananPage() {
  const user = await getSessionUser();
  return <PesananClient role={user?.role ?? "staff"} />;
}
