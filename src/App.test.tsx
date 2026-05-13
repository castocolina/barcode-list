import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThemeProvider } from '@mui/material';
import { theme } from './theme';
import type { ScanResult } from './types';

// Mock hooks and services so no camera or network access occurs
vi.mock('./hooks/useScanner', () => ({
  useScanner: vi.fn(() => ({ lastScan: null, cameraError: null, attachVideo: vi.fn() })),
}));
vi.mock('./hooks/useProductList', () => ({
  useProductList: vi.fn(() => ({ items: [], addItem: vi.fn(), clearItems: vi.fn(), editItemName: vi.fn() })),
}));
vi.mock('./services/barcodeService', () => ({
  lookup: vi.fn(),
}));
vi.mock('./services/soundService', () => ({
  beep: vi.fn(),
}));

import { App } from './App';
import { useScanner } from './hooks/useScanner';
import { useProductList } from './hooks/useProductList';
import { lookup } from './services/barcodeService';
import { beep } from './services/soundService';

const mockUseScanner = vi.mocked(useScanner);
const mockUseProductList = vi.mocked(useProductList);
const mockLookup = vi.mocked(lookup);
const mockBeep = vi.mocked(beep);

function renderApp() {
  return render(
    <ThemeProvider theme={theme}>
      <App />
    </ThemeProvider>
  );
}

describe('App.tsx orchestration', () => {
  const addItem = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseProductList.mockReturnValue({ items: [], addItem, clearItems: vi.fn(), editItemName: vi.fn() });
  });

  it('renders AppBar with title', () => {
    mockUseScanner.mockReturnValue({ lastScan: null, cameraError: null, attachVideo: vi.fn() });
    renderApp();
    expect(screen.getByText('BarcodeList')).toBeInTheDocument();
  });

  it('calls beep before lookup resolves, then addItem on found result', async () => {
    let resolveLookup!: (value: ScanResult | PromiseLike<ScanResult>) => void;
    mockLookup.mockReturnValue(new Promise((res) => { resolveLookup = res; }));
    mockUseScanner.mockReturnValue({ lastScan: { barcode: '12345', scanId: 1 }, cameraError: null, attachVideo: vi.fn() });

    renderApp();

    // beep must fire immediately (before lookup resolves)
    expect(mockBeep).toHaveBeenCalledOnce();
    expect(addItem).not.toHaveBeenCalled();

    resolveLookup({ status: 'found', name: 'Leche entera', brand: 'La Serenísima', source: 'openfoodfacts' });
    await waitFor(() => expect(addItem).toHaveBeenCalledWith({
      barcode: '12345', name: 'Leche entera', brand: 'La Serenísima', source: 'openfoodfacts',
    }));
  });

  it('calls addItem with fallback name on not_found result', async () => {
    mockLookup.mockResolvedValue({ status: 'not_found' });
    mockUseScanner.mockReturnValue({ lastScan: { barcode: '99999', scanId: 2 }, cameraError: null, attachVideo: vi.fn() });

    renderApp();

    await waitFor(() => expect(addItem).toHaveBeenCalledWith({
      barcode: '99999', name: 'Producto desconocido (99999)',
    }));
  });

  it('does NOT call addItem on error result', async () => {
    mockLookup.mockResolvedValue({ status: 'error', message: 'timeout' });
    mockUseScanner.mockReturnValue({ lastScan: { barcode: '11111', scanId: 3 }, cameraError: null, attachVideo: vi.fn() });

    renderApp();

    await waitFor(() => expect(mockLookup).toHaveBeenCalled());
    expect(addItem).not.toHaveBeenCalled();
  });
});
