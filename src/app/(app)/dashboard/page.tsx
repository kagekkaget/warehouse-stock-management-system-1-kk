import { getSessionUser } from "@/lib/auth";
import { ensureDailyBackup } from "@/lib/backup";
import DashboardClient from "./dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getSessionUser();
  // Cadangan otomatis harian (idempoten, maksimal 1x per 20 jam).
  if (user?.role === "owner" || user?.role === "manager") {
    await ensureDailyBackup();
  }
  return <DashboardClient role={user?.role ?? "staff"} />;
}
