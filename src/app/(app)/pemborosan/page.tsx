import { getSessionUser } from "@/lib/auth";
import PemborosanClient from "./pemborosan-client";

export const dynamic = "force-dynamic";

export default async function PemborosanPage() {
  const user = await getSessionUser();
  return <PemborosanClient role={user?.role ?? "staff"} />;
}
