import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock @zxing/library so jsdom does not attempt camera access
vi.mock('@zxing/library', () => ({
  BrowserMultiFormatReader: vi.fn().mockImplementation(() => ({
    decodeFromStream: vi.fn(),
    reset: vi.fn(),
  }) as any),
}));

// Mock navigator.mediaDevices to avoid getUserMedia in jsdom
Object.defineProperty(global.navigator, 'mediaDevices', {
  value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [] }) },
  writable: true,
});

import { useScanner } from './useScanner';
import { BrowserMultiFormatReader } from '@zxing/library';

describe('useScanner — deduplication', () => {
  let fakeNow = 0;

  beforeEach(() => {
    fakeNow = 1_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => fakeNow);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Re-apply the BrowserMultiFormatReader mock implementation after restoreAllMocks
    // clears it (restoreAllMocks affects all vi.fn() instances including those in vi.mock factories).
    vi.mocked(BrowserMultiFormatReader).mockImplementation(() => ({
      decodeFromStream: vi.fn(),
      reset: vi.fn(),
    }) as any);
  });

  function getScanCallback(): (result: { getText: () => string } | null) => void {
    const MockReader = vi.mocked(BrowserMultiFormatReader);
    const instance = MockReader.mock.results[MockReader.mock.results.length - 1].value;
    return instance.decodeFromStream.mock.calls[0]?.[2];
  }

  it('emits lastScan on first scan', async () => {
    const { result } = renderHook(() => useScanner());
    // Provide a fake videoEl to trigger the useEffect
    const fakeVideo = document.createElement('video');
    act(() => { result.current.attachVideo(fakeVideo); });
    await new Promise(resolve => setTimeout(resolve, 0)); // flush async setup

    const cb = getScanCallback();
    act(() => { cb({ getText: () => '12345' }); });
    expect(result.current.lastScan?.barcode).toBe('12345');
    expect(result.current.lastScan?.scanId).toBeGreaterThan(0);
  });

  it('suppresses a second scan of the same barcode within 3 seconds', async () => {
    const { result } = renderHook(() => useScanner());
    const fakeVideo = document.createElement('video');
    act(() => { result.current.attachVideo(fakeVideo); });
    await new Promise(resolve => setTimeout(resolve, 0));

    const cb = getScanCallback();
    act(() => { cb({ getText: () => '12345' }); });
    const firstScanId = result.current.lastScan?.scanId;
    fakeNow += 1000; // 1 second later — still within cooldown
    act(() => { cb({ getText: () => '12345' }); });
    // scanId must not have changed — the second scan was suppressed
    expect(result.current.lastScan?.scanId).toBe(firstScanId);
  });

  it('allows a re-scan of the same barcode after 3 seconds', async () => {
    const { result } = renderHook(() => useScanner());
    const fakeVideo = document.createElement('video');
    act(() => { result.current.attachVideo(fakeVideo); });
    await new Promise(resolve => setTimeout(resolve, 0));

    const cb = getScanCallback();
    act(() => { cb({ getText: () => '12345' }); });
    const firstScanId = result.current.lastScan?.scanId;
    fakeNow += 3001; // past cooldown
    act(() => { cb({ getText: () => '12345' }); });
    // A new scan event was emitted — scanId must have incremented
    expect(result.current.lastScan?.barcode).toBe('12345');
    expect(result.current.lastScan?.scanId).toBeGreaterThan(firstScanId!);
  });
});

describe('useScanner — camera error handling', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(BrowserMultiFormatReader).mockImplementation(() => ({
      decodeFromStream: vi.fn(),
      reset: vi.fn(),
    }) as any);
  });

  function makeGetUserMediaReject(message: string) {
    const err = new Error(message);
    err.name = message.includes('NotAllowed') ? 'NotAllowedError' : 'Error';
    vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockRejectedValueOnce(err);
  }

  it('sets cameraError when camera permission is denied', async () => {
    makeGetUserMediaReject('NotAllowed: permission denied');
    const { result } = renderHook(() => useScanner());
    const fakeVideo = document.createElement('video');
    await act(async () => {
      result.current.attachVideo(fakeVideo);
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    expect(result.current.cameraError).toContain('Permiso de cámara denegado');
  });

  it('sets cameraError with generic message for unknown errors', async () => {
    makeGetUserMediaReject('SomeUnknownError');
    const { result } = renderHook(() => useScanner());
    const fakeVideo = document.createElement('video');
    await act(async () => {
      result.current.attachVideo(fakeVideo);
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    expect(result.current.cameraError).toContain('Error de cámara');
  });
});
