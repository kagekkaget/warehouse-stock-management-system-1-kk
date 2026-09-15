import { getSessionUser } from "@/lib/auth";
import PengaturanClient from "./pengaturan-client";

export const dynamic = "force-dynamic";

export default async function PengaturanPage() {
  const user = await getSessionUser();
  return <PengaturanClient user={{ id: user?.id ?? 0, name: user?.name ?? "", email: user?.email ?? "", role: user?.role ?? "staff" }} />;
}
