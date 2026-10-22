import type { UserData, UserSettings } from "../types";
const KEY = "frame-cs-v1";
export const defaultSettings: UserSettings = {
  theme: "system",
  blind: false,
  mode: "overall",
  sort: "featured",
  shuffleSeed: 1,
  filters: {
    query: "",
    team: "all",
    country: "all",
    collection: "all",
    rank: "all",
    photoOnly: true,
    unratedOnly: false,
  },
};
export const initialData: UserData = {
  schemaVersion: 1,
  ratings: [],
  representatives: {},
  periodRepresentatives: {},
  settings: defaultSettings,
  updatedAt: new Date().toISOString(),
};
let dbPromise: Promise<IDBDatabase> | null = null;
function database() {
  return (dbPromise ??= new Promise((resolve, reject) => {
    try {
      const r = indexedDB.open(KEY, 1);
      r.onupgradeneeded = () => {
        if (!r.result.objectStoreNames.contains("state"))
          r.result.createObjectStore("state");
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    } catch (e) {
      reject(e);
    }
  }));
}
export type StorageStatus = "indexeddb" | "localStorage" | "memory";
export async function readState(): Promise<{
  data: UserData;
  storage: StorageStatus;
}> {
  let backup: UserData | null = null;
  try {
    const s = localStorage.getItem(KEY);
    if (s) backup = JSON.parse(s);
  } catch {}
  try {
    const db = await database();
    const value = await new Promise<UserData | undefined>((resolve, reject) => {
      const req = db.transaction("state").objectStore("state").get("data");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const latest =
      backup && (!value || backup.updatedAt > value.updatedAt) ? backup : value;
    return { data: normalise(latest), storage: "indexeddb" };
  } catch {
    return {
      data: normalise(backup),
      storage: backup || canLocalStorage() ? "localStorage" : "memory",
    };
  }
}
function canLocalStorage() {
  try {
    localStorage.setItem(KEY + "-test", "1");
    localStorage.removeItem(KEY + "-test");
    return true;
  } catch {
    return false;
  }
}
function normalise(d: UserData | null | undefined): UserData {
  return d?.schemaVersion === 1
    ? {
        ...initialData,
        ...d,
        settings: {
          ...defaultSettings,
          ...d.settings,
          filters: { ...defaultSettings.filters, ...d.settings?.filters },
        },
      }
    : structuredClone(initialData);
}
let pending: Promise<StorageStatus> = Promise.resolve("memory");
export function writeState(data: UserData): Promise<StorageStatus> {
  pending = pending
    .catch(() => "memory" as const)
    .then(async () => {
      let fallback = false;
      try {
        localStorage.setItem(KEY, JSON.stringify(data));
        fallback = true;
      } catch {}
      try {
        const db = await database();
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction("state", "readwrite");
          tx.objectStore("state").put(data, "data");
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
        });
        return "indexeddb" as const;
      } catch {
        return fallback ? ("localStorage" as const) : ("memory" as const);
      }
    });
  return pending;
}
