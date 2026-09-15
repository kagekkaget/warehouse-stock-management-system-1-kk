# StokPintar — Sistem Laporan Stok Gudang

Sistem manajemen stok gudang untuk toko kecil berbasis **Next.js 16 (App Router)**, **TypeScript**, **Drizzle ORM**, dan **PostgreSQL** (Neon). Dilengkapi mode offline, laporan PDF/CSV, peringatan kedaluwarsa, hingga cadangan otomatis.

> **Open Source · oleh MZF — 2026**

---

## ⬇ Download Source Code

- **GitHub**: https://github.com/MZF/warehouse-stock-management-system
- **Lisensi**: MIT — lihat [`LICENSE`](./LICENSE)
- **Dokumentasi**: [`README.md`](./README.md)

---

## 📦 Instalasi

```bash
# 1. Salin dependency
npm install

# 2. Atur environment (lihat .env.example)
cp .env.example .env
# Ganti DATABASE_URL dengan Neon/PostgreSQL Anda.
# Catatan: gunakan `uselibpqcompat=true`, jangan `channel_binding`.

# 3. Dorong schema ke database
npx drizzle-kit push

# 4. Jalankan pengembangan
npm run dev
# buka http://localhost:3000
```

Untuk produksi:

```bash
npm run build
npm run start
```

## 🔗 Deploy ke Vercel

1. Import repo ke Vercel.
2. Set environment variable `DATABASE_URL` (sudah dibersihkan dari `channel_binding`).
3. Vercel secara otomatis menjalankan `npm install`, `npm run build`, lalu `npm run start`.
4. Pastikan schema sudah ada di database (jalankan `npx drizzle-kit push` satu kali secara manual, atau tambahkan script `postinstall`).

## 🏗️ Struktur

```
src/
├── app/                   # Halaman & API route (Next.js App Router)
│   ├── api/               # Endpoint REST (auth, products, orders, reports, backup, sync, ...)
│   ├── (app)/             # Grup halaman terautentikasi (dashboard, produk, laporan, ...)
│   ├── login/             # Halaman masuk
│   └── layout.tsx         # Root layout
├── components/            # Komponen klien (AppShell, DataProvider, LoginForm, ui)
├── db/                   # Klien DB (drizzle pool) & schema
├── lib/                  # Bisnis logika (auth, services, permissions, format, offline, backup, seed)
└── proxy.ts               # Proxy (auth redirect, pengganti middleware.ts di Next.js 16)
```

## 🧩 Fitur

- **Autentikasi** scrypt + session cookie (`httpOnly`, `SameSite=Lax`)
- **Peran**: `owner`, `manager`, `staff` dengan matriks izin (`can(role, capability)`)
- **Inventaris**: CRUD produk, stok minimum, tanggal kedaluwarsa, lokasi, supplier
- **Mutasi stok**: masuk / keluar / penyesuaian / pemborosan
- **Pelanggan & Pesanan**: riwayat transaksi, status pembayaran, piutang
- **Pemborosan**: catatan barang rusak/busuk/kedaluwarsa dengan nilai kerugian
- **Laporan**: CSV & PDF (jsPDF + jspdf-autotable), inventaris, penjualan, pemborosan
- **Mode offline**: IndexedDB outbox + Service Worker, sinkronisasi otomatis saat online
- **Cadangan**: otomatis harian (maksimal 1x/20 jam, advisory lock) dan unduh manual (JSON)
- **Audit trail**: jejak aksi sesuai UU No. 27/2022 (PDP)
- **Peringatan**: stok rendah, kedaluwarsa, dan potensi kerugian

## 📝 Akun Demo

| Peran | Email | Kata Sandi |
|-------|-------|------------|
| Pemilik | owner@tokoberkah.id | owner123 |
| Manajer | manager@tokoberkah.id | manager123 |
| Staf | staff@tokoberkah.id | staff123 |

## 🛠️ Teknologi

- Next.js 16 · TypeScript 5.9 · Tailwind CSS 4
- Drizzle ORM 0.45 · pg 8.20
- jspdf 4 · jspdf-autotable 5
- dotenv · PostCSS

## 📄 Lisensi

Dibuka oleh **MZF — 2026**. Lihat `LICENSE` untuk detail (MIT).