import { describe, it, expect, vi, beforeEach } from 'vitest';
import { lookup } from './barcodeService';

describe('barcodeService', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('returns found with Open Food Facts data when it responds first', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          status: 1,
          product: { product_name: 'Leche entera', brands: 'La Serenísima' },
        }), { status: 200 })
      )
      .mockResolvedValue(new Response(JSON.stringify({ items: [] }), { status: 200 }));

    const result = await lookup('7891234567890');
    expect(result.status).toBe('found');
    if (result.status === 'found') {
      expect(result.name).toBe('Leche entera');
      expect(result.brand).toBe('La Serenísima');
      expect(result.source).toBe('openfoodfacts');
    }
  });

  it('returns found with UPC Item DB data when OFF has no result', async () => {
    // Mock call order must match the fetcher array order in barcodeService.ts:
    // call 1 = Open Food Facts (returns no name), call 2 = UPC Item DB (returns name), call 3 = Open EAN DB (aborted)
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        // OFF: no product
        new Response(JSON.stringify({ status: 0 }), { status: 200 })
      )
      .mockResolvedValueOnce(
        // UPC Item DB: has product
        new Response(JSON.stringify({ items: [{ title: 'Galletitas Oreo', brand: 'Oreo' }] }), { status: 200 })
      )
      .mockResolvedValue(new Response('', { status: 200 }));

    const result = await lookup('5012345678901');
    expect(result.status).toBe('found');
    if (result.status === 'found') {
      expect(result.name).toBe('Galletitas Oreo');
      expect(result.source).toBe('upcitemdb');
    }
  });

  it('returns not_found when all APIs return no product name', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 0, items: [] }), { status: 200 })
    );
    const result = await lookup('0000000000000');
    expect(result.status).toBe('not_found');
  });

  it('returns error when all APIs throw (network/CORS errors)', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));
    const result = await lookup('0000000000000');
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.message).toBeTruthy();
    }
  });

  it('never throws regardless of API behavior', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Unexpected'));
    await expect(lookup('123')).resolves.toBeDefined();
  });
});
