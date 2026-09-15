import { getSessionUser } from "@/lib/auth";
import MutasiClient from "./mutasi-client";

export const dynamic = "force-dynamic";

export default async function MutasiPage() {
  const user = await getSessionUser();
  return <MutasiClient role={user?.role ?? "staff"} />;
}
