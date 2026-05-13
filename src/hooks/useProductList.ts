import { useState, useEffect, useCallback } from 'react';
import type { ScanItem } from '../types';
import * as storageService from '../services/storageService';

type AddItemInput = Pick<ScanItem, 'barcode' | 'name'> & Partial<Pick<ScanItem, 'brand' | 'source'>>;

export function useProductList() {
  const [items, setItems] = useState<ScanItem[]>([]);

  useEffect(() => {
    storageService.checkAndClearIfExpired();
    setItems(storageService.getItems());
  }, []);

  const addItem = useCallback((input: AddItemInput) => {
    setItems((prev) => {
      const now = new Date().toISOString();
      const existing = prev.find((i) => i.barcode === input.barcode);
      let next: ScanItem[];
      if (existing) {
        next = prev.map((i) =>
          i.barcode === input.barcode
            ? { ...i, quantity: i.quantity + 1, lastScanned: now }
            : i
        );
      } else {
        const newItem: ScanItem = {
          barcode: input.barcode,
          name: input.name,
          brand: input.brand,
          source: input.source,
          quantity: 1,
          firstScanned: now,
          lastScanned: now,
        };
        next = [newItem, ...prev];
      }
      storageService.writeItems(next);
      return next;
    });
  }, []);

  const clearItems = useCallback(() => {
    storageService.clearItems();
    setItems([]);
  }, []);

  return { items, addItem, clearItems };
}
