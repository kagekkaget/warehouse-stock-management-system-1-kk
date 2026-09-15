import { getSessionUser } from "@/lib/auth";
import PelangganClient from "./pelanggan-client";

export const dynamic = "force-dynamic";

export default async function PelangganPage() {
  const user = await getSessionUser();
  return <PelangganClient role={user?.role ?? "staff"} />;
}
