import type { ScanItem, StorageData } from '../types';

const KEY = 'bl_list';
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function checkAndClearIfExpired(): void {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const data = JSON.parse(raw) as StorageData;
    if (new Date(data.expiresAt) < new Date()) {
      localStorage.removeItem(KEY);
    }
  } catch {
    localStorage.removeItem(KEY);
  }
}

export function getItems(): ScanItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as StorageData;
    return data.items ?? [];
  } catch {
    return [];
  }
}

export function writeItems(items: ScanItem[]): void {
  const data: StorageData = {
    version: 1,
    expiresAt: new Date(Date.now() + TTL_MS).toISOString(),
    items,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) {
    console.error('[storageService] write failed:', e);
  }
}

export function clearItems(): void {
  localStorage.removeItem(KEY);
}
