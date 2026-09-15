"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";

const TRAKTEER_BASE = "https://trakteer.id/perpus_opera/traktir";

/** Nominal traktiran (Rp) — dimulai dari Rp6.000 dan kelipatannya. */
const AMOUNTS = [6000, 12000, 18000, 24000, 30000, 50000, 100000];

function buildUrl(amount: number): string {
  return `${TRAKTEER_BASE}?amount=${amount}`;
}

export default function TrakteerWidget() {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<number>(AMOUNTS[0]);
  const [qrSrc, setQrSrc] = useState<string>("");
  const [generating, setGenerating] = useState<boolean>(true);
  const modalRef = useRef<HTMLDivElement>(null);

  const url = useMemo(() => buildUrl(amount), [amount]);

  useEffect(() => {
    let cancelled = false;
    async function renderQr() {
      try {
        setGenerating(true);
        const dataUrl = await QRCode.toDataURL(url, {
          width: 256,
          margin: 2,
          color: { dark: "#0f172a", light: "#ffffff" },
          errorCorrectionLevel: "M",
        });
        if (!cancelled) setQrSrc(dataUrl);
      } catch {
        if (!cancelled) setQrSrc("");
      } finally {
        if (!cancelled) setGenerating(false);
      }
    }
    void renderQr();
    return () => {
      cancelled = true;
    };
  }, [url]);

  // Tutup modal dengan Escape atau saatOutside
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* Floating button — sudut kanan bawah */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Dukung web app dengan traktiran"
        title="Web app ini gratis & bebas iklan. Kopi kecil, server tetap jalan."
        className="fixed bottom-5 right-5 z-[70] flex items-center gap-2 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg ring-1 ring-amber-300/60 transition hover:scale-105 hover:shadow-xl"
      >
        <span className="text-base">☕</span>
        <span className="hidden sm:inline">Dukung</span>
      </button>

      {/* Modal widget Trakteer */}
      {open && (
        <div
          className="fixed inset-0 z-[75] flex items-end justify-end p-4 sm:items-center sm:justify-center"
          role="dialog"
          aria-modal="true"
          aria-label="Traktir web app"
        >
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div
            ref={modalRef}
            className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-200 animate-rise"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">Trakteer · perpus_opera</p>
                <h3 className="mt-0.5 text-lg font-bold text-slate-900">Dukung Web App Ini</h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                aria-label="Tutup"
              >
                ✕
              </button>
            </div>

            <p className="mt-1 text-sm text-slate-600">
              Web app ini gratis & bebas iklan. Kopi kecil, server tetap jalan. Terima kasih.
            </p>

            {/* Pilihan nominal */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              {AMOUNTS.map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setAmount(val)}
                  className={`rounded-xl px-2 py-2 text-xs font-semibold ring-1 transition ${
                    amount === val
                      ? "bg-amber-500 text-white ring-amber-500"
                      : "bg-slate-50 text-slate-700 ring-slate-200 hover:bg-amber-50"
                  }`}
                >
                  Rp{val.toLocaleString("id-ID")}
                </button>
              ))}
            </div>

            {/* QR Code */}
            <div className="mt-4 flex flex-col items-center">
              <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                {generating ? (
                  <div className="grid h-56 w-56 place-items-center text-sm text-slate-400">
                    Menghasilkan QR…
                  </div>
                ) : qrSrc ? (
                  <img src={qrSrc} alt="QR Code traktiran" className="h-56 w-56" />
                ) : (
                  <div className="grid h-56 w-56 place-items-center text-sm text-rose-500">
                    Gagal menghasilkan QR.
                  </div>
                )}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Scan QR untuk traktir{" "}
                <span className="font-semibold text-slate-700">Rp{amount.toLocaleString("id-ID")}</span>
              </p>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 text-xs font-semibold text-amber-700 hover:underline"
              >
                Buka halaman Trakteer →
              </a>
            </div>

            <p className="mt-3 text-center text-[11px] text-slate-400">
              Dibuka oleh <span className="font-semibold text-slate-500">MZF — 2026</span>
            </p>
          </div>
        </div>
      )}
    </>
  );
}