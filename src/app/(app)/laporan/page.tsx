import { getSessionUser } from "@/lib/auth";
import LaporanClient from "./laporan-client";

export const dynamic = "force-dynamic";

export default async function LaporanPage() {
  const user = await getSessionUser();
  return <LaporanClient role={user?.role ?? "staff"} />;
}
