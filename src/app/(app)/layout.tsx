import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getSessionUser } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";
import { DataProvider } from "@/components/data-provider";
import AppShell from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  await ensureSeeded();
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return (
    <DataProvider>
      <AppShell user={{ id: user.id, name: user.name, email: user.email, role: user.role }}>{children}</AppShell>
    </DataProvider>
  );
}
