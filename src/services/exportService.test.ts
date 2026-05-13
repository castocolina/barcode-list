import { describe, it, expect } from 'vitest';
import { buildCSV, buildCSVFile } from './exportService';
import type { ScanItem } from '../types';

const item: ScanItem = {
  barcode: '7891234567890',
  name: 'Leche entera',
  brand: 'La Serenísima',
  source: 'openfoodfacts',
  quantity: 2,
  firstScanned: '2026-05-12T10:00:00Z',
  lastScanned: '2026-05-12T10:01:00Z',
};

describe('exportService', () => {
  describe('buildCSV', () => {
    it('returns empty string for empty items list', () => {
      expect(buildCSV([])).toBe('');
    });

    it('includes header row', () => {
      const csv = buildCSV([item]);
      const firstLine = csv.split('\n')[0];
      expect(firstLine).toBe('Barcode,Name,Brand,Quantity,First Scanned,Last Scanned,Source');
    });

    it('includes item values in data row', () => {
      const csv = buildCSV([item]);
      expect(csv).toContain('7891234567890');
      expect(csv).toContain('Leche entera');
      expect(csv).toContain('La Serenísima');
      expect(csv).toContain('2');
    });

    it('wraps all values in double quotes', () => {
      const csv = buildCSV([item]);
      const dataRow = csv.split('\n')[1];
      expect(dataRow.startsWith('"')).toBe(true);
    });

    it('escapes double-quotes by doubling them (RFC 4180)', () => {
      const tricky: ScanItem = { ...item, name: 'Item "special"' };
      const csv = buildCSV([tricky]);
      expect(csv).toContain('"Item ""special"""');
    });

    it('handles missing optional fields (brand, source) gracefully', () => {
      const minimal: ScanItem = {
        barcode: '123', name: 'Test', quantity: 1,
        firstScanned: '2026-01-01T00:00:00Z', lastScanned: '2026-01-01T00:00:00Z',
      };
      expect(() => buildCSV([minimal])).not.toThrow();
    });
  });

  describe('buildCSVFile', () => {
    it('returns a File with type text/csv', () => {
      const file = buildCSVFile([item]);
      expect(file.type).toBe('text/csv');
    });

    it('returns a File named lista-productos.csv', () => {
      const file = buildCSVFile([item]);
      expect(file.name).toBe('lista-productos.csv');
    });

    it('returns early (empty content) for empty items', () => {
      const file = buildCSVFile([]);
      expect(file.size).toBe(0);
    });
  });
});
