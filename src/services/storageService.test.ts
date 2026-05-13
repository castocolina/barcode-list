import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as storage from './storageService';

describe('storageService', () => {
  beforeEach(() => localStorage.clear());

  describe('checkAndClearIfExpired', () => {
    it('clears stored data when expiresAt is in the past', () => {
      localStorage.setItem('bl_list', JSON.stringify({
        version: 1,
        expiresAt: new Date(Date.now() - 1000).toISOString(),
        items: [{ barcode: '123', name: 'Test', quantity: 1, firstScanned: '', lastScanned: '' }],
      }));
      storage.checkAndClearIfExpired();
      expect(localStorage.getItem('bl_list')).toBeNull();
    });

    it('keeps data when expiresAt is in the future', () => {
      localStorage.setItem('bl_list', JSON.stringify({
        version: 1,
        expiresAt: new Date(Date.now() + 1_000_000).toISOString(),
        items: [],
      }));
      storage.checkAndClearIfExpired();
      expect(localStorage.getItem('bl_list')).not.toBeNull();
    });

    it('handles missing key gracefully', () => {
      expect(() => storage.checkAndClearIfExpired()).not.toThrow();
    });

    it('clears invalid JSON gracefully', () => {
      localStorage.setItem('bl_list', 'not-json');
      expect(() => storage.checkAndClearIfExpired()).not.toThrow();
      expect(localStorage.getItem('bl_list')).toBeNull();
    });
  });

  describe('getItems', () => {
    it('returns empty array when nothing stored', () => {
      expect(storage.getItems()).toEqual([]);
    });

    it('returns stored items', () => {
      const items = [{ barcode: '123', name: 'Test', quantity: 1, firstScanned: 'a', lastScanned: 'b' }];
      localStorage.setItem('bl_list', JSON.stringify({
        version: 1,
        expiresAt: new Date(Date.now() + 1_000_000).toISOString(),
        items,
      }));
      expect(storage.getItems()).toEqual(items);
    });

    it('returns empty array for invalid JSON', () => {
      localStorage.setItem('bl_list', 'bad');
      expect(storage.getItems()).toEqual([]);
    });
  });

  describe('writeItems', () => {
    it('persists items and sets expiresAt ~7 days from now', () => {
      const items = [{ barcode: '123', name: 'Test', quantity: 1, firstScanned: 'a', lastScanned: 'b' }];
      storage.writeItems(items);
      const raw = JSON.parse(localStorage.getItem('bl_list')!);
      expect(raw.items).toEqual(items);
      const expiresMs = new Date(raw.expiresAt).getTime();
      expect(expiresMs).toBeGreaterThan(Date.now() + 6 * 24 * 60 * 60 * 1000);
    });

    it('does not throw on quota errors', () => {
      const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('QuotaExceededError');
      });
      expect(() => storage.writeItems([])).not.toThrow();
      spy.mockRestore();
    });
  });

  describe('clearItems', () => {
    it('removes the bl_list key', () => {
      localStorage.setItem('bl_list', '{}');
      storage.clearItems();
      expect(localStorage.getItem('bl_list')).toBeNull();
    });
  });
});
