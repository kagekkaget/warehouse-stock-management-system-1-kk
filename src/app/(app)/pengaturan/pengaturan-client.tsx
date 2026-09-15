"use client";

import { useState } from "react";
import { useApiData, useData } from "@/components/data-provider";
import { Badge, ErrorNote, Field, Modal, PageHeader, SectionCard, TableSkeleton, cx } from "@/components/ui";
import { ROLE_LABEL } from "@/lib/permissions";
import type { Role } from "@/lib/auth";
import { ROLE_BADGE, formatDateTime, formatRupiah } from "@/lib/format";
import type { AuditRow, BackupRow, UserRow } from "@/lib/types";

function formatCounts(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as Record<string, number>;
    return Object.entries(parsed)
      .map(([key, value]) => `${value} ${key}`)
      .join(" · ");
  } catch {
    return "-";
  }
}

type UserForm = {
  id: number | null;
  name: string;
  email: string;
  role: string;
  phone: string;
  password: string;
  isActive: boolean;
};

const EMPTY: UserForm = { id: null, name: "", email: "", role: "staff", phone: "", password: "", isActive: true };

export default function PengaturanClient({
  user,
}: {
  user: { id: number; name: string; email: string; role: Role };
}) {
  const { mutate, online, pending, lastSync, syncNow } = useData();
  const users = useApiData<{ items: UserRow[] }>("/api/users");
  const audit = useApiData<{ items: AuditRow[] }>("/api/audit?limit=60");
  const backups = useApiData<{ items: BackupRow[] }>("/api/backups");
  const summary = useApiData<{ inventory: { stockValue: number }; customers: number }>("/api/summary");
  const [form, setForm] = useState<UserForm | null>(null);
  const [busy, setBusy] = useState(false);

  const rows = users.data?.items ?? [];

  async function save() {
    if (!form) return;
    setBusy(true);
    const payload: Record<string, unknown> = {
      name: form.name,
      email: form.email,
      role: form.role,
      phone: form.phone,
      isActive: form.isActive,
    };
    if (form.password) payload.password = form.password;
    const result = form.id
      ? await mutate({ method: "PATCH", path: `/api/users/${form.id}`, body: payload, label: "Perubahan pengguna" })
      : await mutate({ method: "POST", path: "/api/users", body: payload, label: "Pengguna baru" });
    setBusy(false);
    if (result.ok) setForm(null);
  }

  async function remove(row: UserRow) {
    if (!window.confirm(`Hapus akun ${row.name}? Riwayat audit tetap tersimpan.`)) return;
    await mutate({ method: "DELETE", path: `/api/users/${row.id}`, label: "Hapus pengguna" });
  }

  return (
    <>
      <PageHeader
        title="Pengaturan Sistem"
        description="Kelola pengguna & peran, pantau jejak audit, dan unduh cadangan data untuk kepatuhan serta pemulihan."
        actions={
          <a href="/api/backup" className="btn btn-ghost">
            ⬇️ Unduh cadangan (JSON)
          </a>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Status Koneksi</p>
          <p className={cx("mt-1 text-lg font-bold", online ? "text-emerald-600" : "text-slate-600")}>
            {online ? "Online" : "Offline"}
          </p>
          <p className="text-xs text-slate-500">
            {pending > 0 ? `${pending} perubahan menunggu sinkronisasi` : "Semua data tersinkron"}
          </p>
          <button type="button" className="btn btn-ghost mt-2 w-full !py-1 text-xs" onClick={() => void syncNow()}>
            Sinkronkan sekarang
          </button>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Sinkronisasi Terakhir</p>
          <p className="mt-1 text-lg font-bold text-slate-800">{lastSync ? formatDateTime(lastSync) : "-"}</p>
          <p className="text-xs text-slate-500">Sinkronisasi otomatis setiap 20 detik saat online.</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Nilai Persediaan</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-slate-800">
            {formatRupiah(summary.data?.inventory.stockValue ?? 0)}
          </p>
          <p className="text-xs text-slate-500">{summary.data?.customers ?? 0} pelanggan terdaftar</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Akun Anda</p>
          <p className="mt-1 text-lg font-bold text-slate-800">{user.name}</p>
          <Badge className={ROLE_BADGE[user.role]}>{ROLE_LABEL[user.role]}</Badge>
        </div>
      </div>

      <SectionCard
        title="Pengguna & Hak Akses"
        description="Tiga peran: Pemilik (akses penuh), Manajer (operasional & laporan), Staf Gudang (stok & pesanan tanpa data keuangan)."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setForm({ ...EMPTY })}>
            + Pengguna Baru
          </button>
        }
      >
        {users.error ? <ErrorNote message={users.error} /> : null}
        {users.loading && !users.data ? (
          <TableSkeleton rows={4} cols={5} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="pb-2">Nama</th>
                  <th className="pb-2">Email</th>
                  <th className="pb-2">Peran</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Login terakhir</th>
                  <th className="pb-2 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="py-2.5 font-semibold text-slate-800">{row.name}</td>
                    <td className="py-2.5 text-xs text-slate-600">{row.email}</td>
                    <td className="py-2.5">
                      <Badge className={ROLE_BADGE[row.role]}>{ROLE_LABEL[row.role as Role] ?? row.role}</Badge>
                    </td>
                    <td className="py-2.5 text-xs">
                      {row.isActive ? (
                        <span className="text-emerald-600">Aktif</span>
                      ) : (
                        <span className="text-rose-600">Nonaktif</span>
                      )}
                    </td>
                    <td className="py-2.5 text-xs text-slate-500">
                      {row.lastLoginAt ? formatDateTime(row.lastLoginAt) : "belum pernah"}
                    </td>
                    <td className="py-2.5">
                      <div className="flex flex-wrap justify-end gap-1">
                        <button
                          type="button"
                          className="btn btn-ghost !px-2 !py-1 text-xs"
                          onClick={() =>
                            setForm({
                              id: row.id,
                              name: row.name,
                              email: row.email,
                              role: row.role,
                              phone: row.phone ?? "",
                              password: "",
                              isActive: row.isActive,
                            })
                          }
                        >
                          Edit
                        </button>
                        {row.id !== user.id ? (
                          <button type="button" className="btn btn-danger !px-2 !py-1 text-xs" onClick={() => void remove(row)}>
                            Hapus
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Cadangan Data Otomatis"
        description="Snapshot otomatis dibuat maksimal 1 kali per 20 jam saat dasbor dibuka. Simpan salinan di penyimpanan eksternal (mis. Google Drive) untuk pemulihan penuh."
        actions={
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await mutate({ method: "POST", path: "/api/backups", body: { label: "Cadangan manual" }, label: "Cadangan data" });
              setBusy(false);
            }}
          >
            + Buat cadangan sekarang
          </button>
        }
      >
        {backups.loading && !backups.data ? (
          <TableSkeleton rows={3} cols={4} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="pb-2">Waktu</th>
                  <th className="pb-2">Label</th>
                  <th className="pb-2">Cakupan data</th>
                  <th className="pb-2 text-right">Ukuran</th>
                  <th className="pb-2 text-right">Unduh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(backups.data?.items ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-3 text-center text-slate-500">
                      Belum ada cadangan tersimpan.
                    </td>
                  </tr>
                ) : (
                  (backups.data?.items ?? []).map((row) => (
                    <tr key={row.id}>
                      <td className="py-2 text-xs text-slate-600">{formatDateTime(row.createdAt)}</td>
                      <td className="py-2 font-medium text-slate-800">{row.label}</td>
                      <td className="py-2 text-xs text-slate-600">{formatCounts(row.counts)}</td>
                      <td className="py-2 text-right tabular-nums text-xs text-slate-600">
                        {(row.sizeBytes / 1024).toFixed(1)} KB
                      </td>
                      <td className="py-2 text-right">
                        <a href={`/api/backups/${row.id}`} className="btn btn-ghost !px-2 !py-1 text-xs">
                          JSON
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Jejak Audit" description="60 aktivitas terakhir untuk transparansi dan audit kepatuhan">
          {audit.loading && !audit.data ? (
            <TableSkeleton rows={6} cols={3} />
          ) : (
            <ul className="max-h-[28rem] divide-y divide-slate-100 overflow-y-auto text-sm">
              {(audit.data?.items ?? []).map((row) => (
                <li key={row.id} className="flex items-start justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-800">
                      {row.userName ?? "sistem"} · <span className="text-slate-500">{row.action}</span> {row.entity}
                      {row.entityId ? `#${row.entityId}` : ""}
                    </p>
                    <p className="truncate text-xs text-slate-500">{row.detail ?? "-"}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-slate-400">{formatDateTime(row.createdAt)}</span>
                </li>
              ))}
              {(audit.data?.items ?? []).length === 0 ? <li className="py-3 text-slate-500">Belum ada aktivitas.</li> : null}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Keamanan & Kepatuhan Data" description="Ringkasan praktik pelindungan data yang diterapkan">
          <ul className="space-y-3 text-sm text-slate-700">
            {[
              {
                title: "Autentikasi aman",
                body: "Kata sandi di-hash dengan scrypt + salt unik. Sesi disimpan sebagai token SHA-256 di database dengan cookie httpOnly dan masa berlaku 7 hari.",
              },
              {
                title: "Pembatasan percobaan masuk",
                body: "Maksimal 8 percobaan login gagal per 10 menit untuk satu email/IP guna mencegah brute force.",
              },
              {
                title: "Hak akses berbasis peran (RBAC)",
                body: "Setiap endpoint API memeriksa izin per aksi. Staf tidak dapat melihat nilai keuangan atau menghapus data induk.",
              },
              {
                title: "Kepatuhan UU No. 27/2022 (PDP)",
                body: "Data pribadi pelanggan hanya untuk operasional toko. Persetujuan pemasaran dicatat per pelanggan dan dapat dicabut. Penghapusan pelanggan memutus tautan data pribadi dari riwayat pesanan.",
              },
              {
                title: "Jejak audit & cadangan",
                body: "Semua perubahan dicatat (siapa, kapan, apa). Cadangan lengkap dapat diunduh sebagai JSON kapan saja dari tombol di atas.",
              },
              {
                title: "Mode offline",
                body: "Perubahan saat offline disimpan di IndexedDB perangkat dan disinkronkan otomatis saat koneksi kembali, dengan validasi izin di server.",
              },
            ].map((item) => (
              <li key={item.title} className="rounded-xl bg-slate-50 p-3">
                <p className="font-semibold text-slate-800">{item.title}</p>
                <p className="mt-0.5 text-xs text-slate-600">{item.body}</p>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <Modal
        open={form !== null}
        title={form?.id ? "Edit Pengguna" : "Tambah Pengguna"}
        description="Kata sandi minimal 8 karakter."
        onClose={() => setForm(null)}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>
              Batal
            </button>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void save()}>
              {busy ? "Menyimpan…" : "Simpan"}
            </button>
          </>
        }
      >
        {form ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nama">
              <input className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Email">
              <input className="field" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Peran">
              <select className="field" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="owner">Pemilik</option>
                <option value="manager">Manajer</option>
                <option value="staff">Staf Gudang</option>
              </select>
            </Field>
            <Field label="Telepon">
              <input className="field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field
              label={form.id ? "Kata sandi baru (opsional)" : "Kata sandi"}
              className="sm:col-span-2"
              hint="Minimal 8 karakter."
            >
              <input
                className="field"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </Field>
            <label className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600 sm:col-span-2">
              <input
                type="checkbox"
                className="h-4 w-4 accent-teal-600"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              />
              Akun aktif (dapat masuk ke sistem)
            </label>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
