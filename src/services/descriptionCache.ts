const KEY = 'bl_desc';
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface Entry { name: string; expiresAt: string; }
type Cache = Record<string, Entry>;

function load(): Cache {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch { return {}; }
}

function save(c: Cache): void {
  try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* ignore */ }
}

export function getOverride(barcode: string): string | null {
  const cache = load();
  const entry = cache[barcode];
  if (!entry) return null;
  if (new Date(entry.expiresAt) < new Date()) {
    delete cache[barcode];
    save(cache);
    return null;
  }
  return entry.name;
}

export function setOverride(barcode: string, name: string): void {
  const cache = load();
  cache[barcode] = { name, expiresAt: new Date(Date.now() + TTL_MS).toISOString() };
  save(cache);
}
