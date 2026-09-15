"use client";

const DB_NAME = "stokpintar-offline";
const DB_VERSION = 1;
const CACHE_STORE = "responses";
const OUTBOX_STORE = "outbox";

export type OutboxOp = {
  id: string;
  method: string;
  path: string;
  body?: unknown;
  label: string;
  createdAt: number;
};

function hasIndexedDb(): boolean {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase | null> {
  if (!hasIndexedDb()) return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CACHE_STORE)) db.createObjectStore(CACHE_STORE, { keyPath: "url" });
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) db.createObjectStore(OUTBOX_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

async function withStore<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise<T | null>((resolve) => {
    const tx = db.transaction(store, mode);
    const request = run(tx.objectStore(store));
    tx.oncomplete = () => resolve(request ? ((request as IDBRequest<T>).result ?? null) : null);
    tx.onerror = () => resolve(null);
    tx.onabort = () => resolve(null);
  });
}

/* ------------------------------- Cache GET -------------------------------- */

export async function cacheGet<T>(url: string): Promise<{ data: T; savedAt: number } | null> {
  const row = await withStore<{ url: string; data: T; savedAt: number }>(CACHE_STORE, "readonly", (store) =>
    store.get(url) as IDBRequest<{ url: string; data: T; savedAt: number }>,
  );
  return row && row.data !== undefined ? { data: row.data, savedAt: row.savedAt } : null;
}

export async function cacheSet<T>(url: string, data: T): Promise<void> {
  await withStore(CACHE_STORE, "readwrite", (store) => {
    store.put({ url, data, savedAt: Date.now() });
  });
}

/* --------------------------------- Outbox --------------------------------- */

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function outboxAdd(op: Omit<OutboxOp, "id" | "createdAt"> & { id?: string }): Promise<OutboxOp> {
  const entry: OutboxOp = { id: op.id ?? newId(), createdAt: Date.now(), ...op } as OutboxOp;
  await withStore(OUTBOX_STORE, "readwrite", (store) => {
    store.put(entry);
  });
  return entry;
}

export async function outboxAll(): Promise<OutboxOp[]> {
  const rows = await withStore<OutboxOp[]>(OUTBOX_STORE, "readonly", (store) =>
    store.getAll() as IDBRequest<OutboxOp[]>,
  );
  return (rows ?? []).sort((a, b) => a.createdAt - b.createdAt);
}

export async function outboxRemove(ids: string[]): Promise<void> {
  for (const id of ids) {
    await withStore(OUTBOX_STORE, "readwrite", (store) => {
      store.delete(id);
    });
  }
}

/* ------------------------------- HTTP helpers ------------------------------ */

export class OfflineError extends Error {
  constructor(message = "Perangkat sedang offline dan data belum tersimpan di cache.") {
    super(message);
    this.name = "OfflineError";
  }
}

export async function apiGet<T>(url: string): Promise<T> {
  if (typeof navigator === "undefined" || navigator.onLine) {
    try {
      const response = await fetch(url, { credentials: "same-origin", headers: { accept: "application/json" } });
      if (response.status === 401 && typeof window !== "undefined") {
        window.location.href = "/login";
        throw new OfflineError("Sesi berakhir.");
      }
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? `Gagal memuat data (${response.status}).`);
      }
      const data = (await response.json()) as T;
      void cacheSet(url, data);
      return data;
    } catch (error) {
      if (error instanceof TypeError) {
        const cached = await cacheGet<T>(url);
        if (cached) return cached.data;
        throw new OfflineError();
      }
      throw error;
    }
  }
  const cached = await cacheGet<T>(url);
  if (cached) return cached.data;
  throw new OfflineError();
}

export type MutationResult<T = unknown> = {
  ok: boolean;
  queued?: boolean;
  data?: T;
  error?: string;
};

export async function apiSend<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
): Promise<MutationResult<T>> {
  if (typeof navigator === "undefined" || navigator.onLine) {
    try {
      const response = await fetch(path, {
        method,
        credentials: "same-origin",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (response.status === 401 && typeof window !== "undefined") {
        window.location.href = "/login";
        return { ok: false, error: "Sesi berakhir." };
      }
      const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
      if (!response.ok) return { ok: false, error: payload?.error ?? `Permintaan gagal (${response.status}).` };
      return { ok: true, data: payload };
    } catch (error) {
      if (!(error instanceof TypeError)) {
        return { ok: false, error: "Permintaan gagal dikirim." };
      }
      // koneksi terputus saat mengirim → masuk antrean
    }
  }
  return { ok: true, queued: true };
}

export type FlushOutcome = { synced: number; failed: number; messages: string[] };

export async function flushOutbox(): Promise<FlushOutcome> {
  const ops = await outboxAll();
  if (!ops.length) return { synced: 0, failed: 0, messages: [] };
  try {
    const response = await fetch("/api/sync", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ operations: ops.map(({ method, path, body, id }) => ({ id, method, path, body })) }),
    });
    if (!response.ok) return { synced: 0, failed: ops.length, messages: ["Sinkronisasi gagal, akan dicoba lagi."] };
    const payload = (await response.json()) as {
      results: Array<{ id: string; ok: boolean; error?: string }>;
    };
    const successIds = payload.results.filter((r) => r.ok).map((r) => r.id);
    const messages = payload.results.filter((r) => !r.ok).map((r) => r.error ?? "Operasi gagal.");
    await outboxRemove(successIds);
    return { synced: successIds.length, failed: messages.length, messages };
  } catch {
    return { synced: 0, failed: ops.length, messages: ["Masih tidak ada koneksi."] };
  }
}
