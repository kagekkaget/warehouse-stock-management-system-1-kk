"use client";

import type { ReactNode } from "react";
import { useData } from "@/components/data-provider";
import { formatRupiah } from "@/lib/format";

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx("badge", className ?? "bg-slate-100 text-slate-700")}>{children}</span>;
}

export function StatCard({
  label,
  value,
  hint,
  tone = "slate",
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "slate" | "teal" | "amber" | "rose" | "sky";
  icon?: ReactNode;
}) {
  const tones: Record<string, string> = {
    slate: "from-slate-50 to-white text-slate-900",
    teal: "from-teal-50 to-white text-teal-900",
    amber: "from-amber-50 to-white text-amber-900",
    rose: "from-rose-50 to-white text-rose-900",
    sky: "from-sky-50 to-white text-sky-900",
  };
  return (
    <div className={cx("card bg-gradient-to-br p-4", tones[tone])}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        {icon ? <span className="text-lg leading-none">{icon}</span> : null}
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-slate-600">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("card p-4 sm:p-5", className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">{title}</h2>
          {description ? <p className="text-xs text-slate-500">{description}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Field({
  label,
  children,
  hint,
  className,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1 block text-xs font-semibold text-slate-600">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  wide,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className={cx("card animate-rise my-6 w-full p-5", wide ? "max-w-4xl" : "max-w-2xl")}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{title}</h3>
            {description ? <p className="mt-0.5 text-sm text-slate-600">{description}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Tutup">
            ✕
          </button>
        </div>
        <div>{children}</div>
        {footer ? <div className="mt-5 flex flex-wrap justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-8 text-center">
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {description ? <p className="mt-1 text-xs text-slate-500">{description}</p> : null}
      {action ? <div className="mt-3 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: cols }).map((__, colIndex) => (
            <div key={colIndex} className="skeleton h-8 rounded-lg" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
      <strong className="font-semibold">Tidak dapat memuat data.</strong> {message}
    </div>
  );
}

export function TrendChart({ data }: { data: Array<{ day: string; revenue: number; count: number }> }) {
  if (!data.length) {
    return <EmptyState title="Belum ada transaksi" description="Grafik akan muncul setelah pesanan pertama dicatat." />;
  }
  const max = Math.max(...data.map((d) => d.revenue), 1);
  return (
    <div className="flex h-40 items-end gap-1.5">
      {data.map((point) => {
        const height = Math.max(6, Math.round((point.revenue / max) * 100));
        return (
          <div key={point.day} className="group relative flex flex-1 flex-col items-center justify-end">
            <div
              className="w-full rounded-t-md bg-gradient-to-t from-teal-500 to-teal-300 transition-all group-hover:from-teal-600"
              style={{ height: `${height}%` }}
            />
            <span className="mt-1 hidden text-[10px] text-slate-500 sm:block">{point.day.slice(8)}</span>
            <span className="pointer-events-none absolute -top-8 z-10 hidden whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] text-white group-hover:block">
              {point.day.slice(5)} · {formatRupiah(point.revenue)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function Toasts() {
  const { toasts, dismissToast } = useData();
  if (!toasts.length) return null;
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(92vw,22rem)] flex-col gap-2">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          onClick={() => dismissToast(toast.id)}
          className={cx(
            "pointer-events-auto animate-rise rounded-xl px-4 py-3 text-left text-sm shadow-lg ring-1",
            toast.tone === "success" && "bg-emerald-50 text-emerald-800 ring-emerald-200",
            toast.tone === "error" && "bg-rose-50 text-rose-800 ring-rose-200",
            toast.tone === "info" && "bg-sky-50 text-sky-800 ring-sky-200",
          )}
        >
          {toast.message}
        </button>
      ))}
    </div>
  );
}
