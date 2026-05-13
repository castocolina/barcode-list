import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useProductList } from './useProductList';
import * as storage from '../services/storageService';

vi.mock('../services/storageService');

const mockStorage = vi.mocked(storage);

describe('useProductList', () => {
  beforeEach(() => {
    mockStorage.checkAndClearIfExpired.mockImplementation(() => {});
    mockStorage.getItems.mockReturnValue([]);
    mockStorage.writeItems.mockImplementation(() => {});
    mockStorage.clearItems.mockImplementation(() => {});
  });

  it('calls checkAndClearIfExpired and getItems on mount', () => {
    renderHook(() => useProductList());
    expect(mockStorage.checkAndClearIfExpired).toHaveBeenCalledOnce();
    expect(mockStorage.getItems).toHaveBeenCalledOnce();
  });

  it('initialises with items from storageService', () => {
    const stored = [{ barcode: '123', name: 'Test', quantity: 1, firstScanned: 'a', lastScanned: 'b' }];
    mockStorage.getItems.mockReturnValue(stored);
    const { result } = renderHook(() => useProductList());
    expect(result.current.items).toEqual(stored);
  });

  it('addItem adds a new item with quantity 1', () => {
    const { result } = renderHook(() => useProductList());
    act(() => { result.current.addItem({ barcode: '123', name: 'Test' }); });
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(1);
    expect(result.current.items[0].barcode).toBe('123');
  });

  it('addItem increments quantity for duplicate barcode', () => {
    const { result } = renderHook(() => useProductList());
    act(() => { result.current.addItem({ barcode: '123', name: 'Test' }); });
    act(() => { result.current.addItem({ barcode: '123', name: 'Test' }); });
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(2);
  });

  it('addItem prepends new items (most recent first)', () => {
    const { result } = renderHook(() => useProductList());
    act(() => { result.current.addItem({ barcode: '111', name: 'First' }); });
    act(() => { result.current.addItem({ barcode: '222', name: 'Second' }); });
    expect(result.current.items[0].barcode).toBe('222');
  });

  it('addItem calls writeItems', () => {
    const { result } = renderHook(() => useProductList());
    act(() => { result.current.addItem({ barcode: '123', name: 'Test' }); });
    expect(mockStorage.writeItems).toHaveBeenCalled();
  });

  it('clearItems empties the list and calls storageService.clearItems', () => {
    const { result } = renderHook(() => useProductList());
    act(() => { result.current.addItem({ barcode: '123', name: 'Test' }); });
    act(() => { result.current.clearItems(); });
    expect(result.current.items).toHaveLength(0);
    expect(mockStorage.clearItems).toHaveBeenCalled();
  });
});
