"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  apiGet,
  apiSend,
  flushOutbox,
  outboxAdd,
  outboxAll,
  type MutationResult,
} from "@/lib/client/offline";

type Toast = { id: number; message: string; tone: "success" | "error" | "info" };

type DataContextValue = {
  online: boolean;
  pending: number;
  syncing: boolean;
  lastSync: string | null;
  toasts: Toast[];
  notify: (message: string, tone?: Toast["tone"]) => void;
  dismissToast: (id: number) => void;
  mutate: (options: {
    method: string;
    path: string;
    body?: unknown;
    label: string;
    silent?: boolean;
  }) => Promise<MutationResult>;
  refresh: () => void;
  registerReload: (fn: () => void) => () => void;
  syncNow: () => Promise<void>;
};

const DataContext = createContext<DataContextValue | null>(null);

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData harus dipakai di dalam DataProvider");
  return ctx;
}

export function useApiData<T>(url: string | null) {
  const { registerReload, online } = useData();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(url));
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!url) return;
      if (!silent) setLoading(true);
      try {
        const result = await apiGet<T>(url);
        setData(result);
        setError(null);
        setFromCache(!online);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memuat data.");
      } finally {
        setLoading(false);
      }
    },
    [url, online],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => registerReload(() => void load(true)), [registerReload, load]);

  return { data, loading, error, fromCache, reload: () => void load(true) };
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const reloaders = useRef(new Set<() => void>());
  const toastId = useRef(1);

  const notify = useCallback((message: string, tone: Toast["tone"] = "info") => {
    const id = toastId.current++;
    setToasts((prev) => [...prev.slice(-3), { id, message, tone }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4200);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const refresh = useCallback(() => {
    reloaders.current.forEach((fn) => fn());
  }, []);

  const registerReload = useCallback((fn: () => void) => {
    reloaders.current.add(fn);
    return () => {
      reloaders.current.delete(fn);
    };
  }, []);

  const countPending = useCallback(async () => {
    const ops = await outboxAll();
    setPending(ops.length);
    return ops.length;
  }, []);

  const syncNow = useCallback(async () => {
    const ops = await outboxAll();
    if (!ops.length || syncing) return;
    setSyncing(true);
    const outcome = await flushOutbox();
    setSyncing(false);
    await countPending();
    setLastSync(new Date().toISOString());
    if (outcome.synced > 0) {
      notify(`${outcome.synced} perubahan offline berhasil disinkronkan.`, "success");
      refresh();
    }
    if (outcome.failed > 0) {
      notify(`${outcome.failed} operasi gagal: ${outcome.messages[0] ?? ""}`, "error");
    }
  }, [countPending, notify, refresh, syncing]);

  const mutate = useCallback<DataContextValue["mutate"]>(
    async ({ method, path, body, label, silent }) => {
      const result = await apiSend(method, path, body);
      if (result.queued) {
        await outboxAdd({ method, path, body, label });
        await countPending();
        if (!silent) notify(`Offline: "${label}" disimpan lokal & akan disinkronkan otomatis.`, "info");
        refresh();
        return result;
      }
      if (!result.ok) {
        if (!silent) notify(result.error ?? `"${label}" gagal.`, "error");
        return result;
      }
      if (!silent) notify(`"${label}" berhasil disimpan.`, "success");
      refresh();
      return result;
    },
    [countPending, notify, refresh],
  );

  useEffect(() => {
    setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    void countPending();
    const goOnline = () => {
      setOnline(true);
      void syncNow();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    const timer = window.setInterval(() => {
      void countPending();
      if (navigator.onLine) void syncNow();
    }, 20000);
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.clearInterval(timer);
    };
  }, [countPending, syncNow]);

  const value = useMemo<DataContextValue>(
    () => ({
      online,
      pending,
      syncing,
      lastSync,
      toasts,
      notify,
      dismissToast,
      mutate,
      refresh,
      registerReload,
      syncNow,
    }),
    [online, pending, syncing, lastSync, toasts, notify, dismissToast, mutate, refresh, registerReload, syncNow],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
