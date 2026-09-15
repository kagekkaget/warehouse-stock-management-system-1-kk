"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useData } from "@/components/data-provider";
import { Toasts, cx } from "@/components/ui";
import { can, ROLE_LABEL, type Capability } from "@/lib/permissions";
import type { Role } from "@/lib/auth";

type NavItem = { href: string; label: string; icon: string; cap?: Capability };

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dasbor", icon: "📊" },
  { href: "/produk", label: "Inventaris", icon: "📦", cap: "product.view" },
  { href: "/mutasi", label: "Mutasi Stok", icon: "🔄", cap: "movement.view" },
  { href: "/pesanan", label: "Pesanan", icon: "🧾", cap: "order.view" },
  { href: "/pelanggan", label: "Pelanggan", icon: "👥", cap: "customer.view" },
  { href: "/pemborosan", label: "Pemborosan", icon: "🗑️", cap: "waste.view" },
  { href: "/laporan", label: "Laporan", icon: "📑", cap: "report.operational" },
  { href: "/pengaturan", label: "Pengaturan", icon: "⚙️", cap: "audit.view" },
];

export default function AppShell({
  user,
  children,
}: {
  user: { id: number; name: string; email: string; role: Role };
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { online, pending, syncing, syncNow, lastSync } = useData();
  const [openNav, setOpenNav] = useState(false);
  const items = NAV.filter((item) => !item.cap || can(user.role, item.cap));

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    router.replace("/login");
    router.refresh();
  }

  const initials = user.name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen lg:flex">
      <aside
        className={cx(
          "z-40 w-full shrink-0 bg-slate-900 text-slate-100 lg:sticky lg:top-0 lg:h-screen lg:w-64",
          openNav ? "block" : "hidden lg:block",
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-2 px-5 py-5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-teal-400 to-emerald-500 text-sm font-black text-slate-900">
              SP
            </span>
            <div>
              <p className="text-sm font-bold leading-tight">StokPintar</p>
              <p className="text-[11px] text-slate-400">Laporan Stok Gudang</p>
            </div>
          </div>
          <nav className="flex-1 space-y-1 px-3">
            {items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpenNav(false)}
                  className={cx(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                    active ? "bg-teal-500/15 text-teal-200 ring-1 ring-teal-400/30" : "text-slate-300 hover:bg-white/5",
                  )}
                >
                  <span className="text-base">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-white/10 p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-teal-500/20 text-xs font-bold text-teal-200">
                {initials}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{user.name}</p>
                <p className="truncate text-[11px] text-slate-400">{ROLE_LABEL[user.role]}</p>
              </div>
            </div>
            <button type="button" onClick={logout} className="btn btn-ghost mt-3 w-full">
              Keluar
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white/85 px-4 py-3 backdrop-blur lg:px-6">
          <button
            type="button"
            className="btn btn-ghost lg:hidden"
            onClick={() => setOpenNav((prev) => !prev)}
            aria-label="Buka menu"
          >
            ☰
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-slate-500">
              {ROLE_LABEL[user.role]} · {user.email}
            </p>
            <p className="text-sm font-semibold text-slate-800">
              {items.find((item) => pathname.startsWith(item.href))?.label ?? "StokPintar"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {pending > 0 ? (
              <button
                type="button"
                onClick={() => void syncNow()}
                className="badge bg-amber-100 text-amber-800 ring-amber-200"
                title="Sinkronkan sekarang"
              >
                {syncing ? "Menyinkronkan…" : `${pending} perubahan offline`}
              </button>
            ) : null}
            <span
              className={cx(
                "badge",
                online ? "bg-emerald-100 text-emerald-700 ring-emerald-200" : "bg-slate-200 text-slate-700 ring-slate-300",
              )}
              title={lastSync ? `Sinkron terakhir: ${new Date(lastSync).toLocaleString("id-ID")}` : undefined}
            >
              {online ? "● Online" : "◌ Offline"}
            </span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 space-y-5 px-4 py-6 lg:px-6">{children}</main>
        <footer className="border-t border-slate-200 bg-white/60 px-4 py-3 text-center text-[11px] text-slate-500 lg:px-6">
          StokPintar © {new Date().getFullYear()} · Data pelanggan diproses sesuai UU No. 27/2022 (PDP) · Cadangan
          otomatis tersedia melalui menu Pengaturan
        </footer>
      </div>
      <Toasts />
    </div>
  );
}
