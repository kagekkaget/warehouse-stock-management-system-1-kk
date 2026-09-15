"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiSend } from "@/lib/client/offline";

const DEMO = [
  { role: "Pemilik", email: "owner@tokoberkah.id", password: "owner123" },
  { role: "Manajer", email: "manager@tokoberkah.id", password: "manager123" },
  { role: "Staf Gudang", email: "staff@tokoberkah.id", password: "staff123" },
];

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("owner@tokoberkah.id");
  const [password, setPassword] = useState("owner123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const result = await apiSend<{ user: { name: string } }>("POST", "/api/auth/login", { email, password });
    if (!result.ok) {
      setError(result.error ?? "Gagal masuk.");
      setLoading(false);
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-teal-800 via-teal-700 to-emerald-800 p-10 text-white lg:flex">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10" />
        <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-white/5" />
        <div className="relative">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-200">StokPintar</p>
          <h1 className="mt-4 max-w-md text-4xl font-bold leading-tight">
            Sistem Laporan Stok Gudang untuk Toko Kecil
          </h1>
          <p className="mt-4 max-w-md text-teal-50/90">
            Pantau stok real-time, tanggal kedaluwarsa, dan pemborosan barang. Kurangi rugi, optimalkan pemesanan,
            dan siapkan laporan PDF/CSV dalam sekali klik.
          </p>
        </div>
        <ul className="relative space-y-3 text-sm text-teal-50">
          {[
            "Peringatan otomatis stok rendah & produk mendekati kedaluwarsa",
            "Manajemen pelanggan, pesanan, dan status pembayaran",
            "Laporan inventaris, penjualan, dan pemborosan siap unduh",
            "Mode offline dengan sinkronisasi otomatis saat online kembali",
          ].map((item) => (
            <li key={item} className="flex gap-2">
              <span className="mt-0.5 text-teal-200">✔</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="relative text-xs text-teal-100/80">
          Data pelanggan diproses sesuai UU No. 27/2022 tentang Pelindungan Data Pribadi.
        </p>
      </section>

      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-6 lg:hidden">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-700">StokPintar</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">Sistem Laporan Stok Gudang</h1>
          </div>
          <div className="card p-6">
            <h2 className="text-lg font-bold text-slate-900">Masuk ke akun Anda</h2>
            <p className="mt-1 text-sm text-slate-600">Gunakan email dan kata sandi yang diberikan pemilik toko.</p>
            <form onSubmit={submit} className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Email</span>
                <input
                  className="field"
                  type="email"
                  value={email}
                  autoComplete="email"
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Kata sandi</span>
                <input
                  className="field"
                  type="password"
                  value={password}
                  autoComplete="current-password"
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>
              {error ? (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{error}</p>
              ) : null}
              <button type="submit" className="btn btn-primary w-full" disabled={loading}>
                {loading ? "Memproses…" : "Masuk"}
              </button>
            </form>
          </div>

          <div className="card mt-4 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Akun demo</p>
            <div className="mt-2 space-y-2">
              {DEMO.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => {
                    setEmail(account.email);
                    setPassword(account.password);
                  }}
                  className="flex w-full items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-left text-xs hover:bg-slate-100"
                >
                  <span className="font-semibold text-slate-700">{account.role}</span>
                  <span className="text-slate-500">
                    {account.email} · {account.password}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
