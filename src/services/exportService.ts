import type { ScanItem } from '../types';

const HEADERS = ['Barcode', 'Name', 'Brand', 'Quantity', 'First Scanned', 'Last Scanned', 'Source'];

function quote(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function buildCSV(items: ScanItem[]): string {
  if (items.length === 0) return '';
  const rows = items.map((item) =>
    [
      item.barcode,
      item.name,
      item.brand ?? '',
      String(item.quantity),
      item.firstScanned,
      item.lastScanned,
      item.source ?? '',
    ]
      .map(quote)
      .join(',')
  );
  return [HEADERS.join(','), ...rows].join('\n');
}

export function buildCSVFile(items: ScanItem[]): File {
  const csv = buildCSV(items);
  return new File([csv], 'lista-productos.csv', { type: 'text/csv' });
}
