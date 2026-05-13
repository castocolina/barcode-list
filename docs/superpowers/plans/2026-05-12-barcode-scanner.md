# Barcode Scanner Web App — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first React + MUI v7 barcode scanner PWA deployed on GitHub Pages that scans products via camera, looks up descriptions from 3 free APIs in parallel, keeps a persistent list, and exports via the native OS share sheet.

**Architecture:** Pure static client-side app — no backend. `useScanner` owns ZXing camera lifecycle; `App.tsx` orchestrates the scan event flow (beep → lookup → addItem → toast). All state persists to `localStorage` via `storageService`.

**Tech Stack:** React 18 + Vite + TypeScript + MUI v7 + `@zxing/library` + Vitest + React Testing Library + GitHub Actions

---

## File Map

```
src/
  types.ts
  theme.ts
  test-setup.ts
  services/
    storageService.ts        # localStorage read/write/expiry
    storageService.test.ts
    barcodeService.ts        # raceToSuccess parallel lookup
    barcodeService.test.ts
    soundService.ts          # Web Audio API beep + iOS resume
    exportService.ts         # CSV serialization + File construction
    exportService.test.ts
  hooks/
    useProductList.ts        # list state + storage sync
    useProductList.test.ts
    useScanner.ts            # ZXing lifecycle + deduplication
    useScanner.test.ts
  components/
    ScannerView.tsx          # video element + viewfinder + cameraError
    ClearDialog.tsx          # MUI Dialog confirmation
    ProductList.tsx          # MUI List + clear trigger
    Toast.tsx                # MUI Snackbar/Alert wrapper
    ExportButton.tsx         # Web Share API + download fallback
  App.tsx                    # orchestrator
  App.test.tsx               # integration tests for App.tsx orchestration (scan → beep → lookup → addItem → toast)
  main.tsx
vite.config.ts
.github/workflows/deploy.yml
.gitignore
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/test-setup.ts`, `.gitignore`

- [ ] **Step 1: Scaffold the Vite project**

```bash
cd /home/user-zero/git/cco/barcode-list
npm create vite@latest . -- --template react-ts
```

Note: Because the directory already contains `docs/` and `.superpowers/` subdirectories, Vite will prompt: `Current directory is not empty. Please choose how to proceed:`. Select **"Ignore files and continue"**. A non-interactive agent can pass input via: `echo "Ignore files and continue" | npm create vite@latest . -- --template react-ts`, or use `npx create-vite@latest . --template react-ts` which may honour the `--force` flag on some versions.

Expected: Vite scaffolds `package.json`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`.

- [ ] **Step 2: Install all dependencies**

```bash
npm install @mui/material@^7 @mui/icons-material@^7 @emotion/react @emotion/styled @zxing/library
npm install --save-dev vitest@^2 @vitest/ui jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 3: Replace `vite.config.ts` with test-enabled config**

```typescript
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/barcode-list/',
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
});
```

- [ ] **Step 4: Create `src/test-setup.ts`**

```typescript
import '@testing-library/jest-dom';
```

- [ ] **Step 5: Add test script to `package.json`**

Open `package.json` and add to the `"scripts"` section:
```json
"test": "vitest",
"test:ui": "vitest --ui"
```

- [ ] **Step 6: Replace `index.html` title and add viewport meta**

In `index.html`, update the `<head>`:
```html
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
<title>BarcodeList</title>
```

- [ ] **Step 7: Create `.gitignore`**

```
node_modules
dist
.env
.superpowers/
```

- [ ] **Step 8: Verify the dev server starts**

```bash
npm run dev
```

Expected: Vite server starts on `http://localhost:5173/barcode-list/`. Press Ctrl+C to stop.

- [ ] **Step 9: Run tests (zero tests, should pass)**

```bash
npm test -- --run
```

Expected: `No test files found`. Exit 0.

- [ ] **Step 10: Commit**

```bash
git init
git add -A
git commit -m "feat: scaffold Vite + React + TypeScript + MUI + Vitest"
```

---

## Task 2: Shared Types + MUI Theme

**Files:**
- Create: `src/types.ts`, `src/theme.ts`
- Modify: `src/main.tsx`

- [ ] **Step 1: Create `src/types.ts`**

```typescript
export interface ScanItem {
  barcode: string;
  name: string;
  brand?: string;
  source?: string;
  quantity: number;
  firstScanned: string; // ISO 8601
  lastScanned: string;  // ISO 8601
}

export interface StorageData {
  version: 1;
  expiresAt: string; // ISO 8601
  items: ScanItem[];
}

// Returned by barcodeService.lookup()
export type ScanResult =
  | { status: 'found'; name: string; brand?: string; source: string }
  | { status: 'not_found' }
  | { status: 'error'; message: string };

// Used by Toast — App.tsx converts ScanResult → ToastData, adding barcode context
export type ToastData =
  | { status: 'found'; name: string }
  | { status: 'not_found'; barcode: string }
  | { status: 'error' };

// Emitted by useScanner on each accepted scan; new object per scan so React's
// useEffect always re-fires, even for repeated barcodes after the cooldown.
// useScanner return type: { lastScan: ScanEvent | null; cameraError: string | null; attachVideo: (el: HTMLVideoElement | null) => void }
export interface ScanEvent {
  barcode: string;
  scanId: number;
}
```

- [ ] **Step 2: Create `src/theme.ts`**

```typescript
import { createTheme } from '@mui/material/styles';
import { blue } from '@mui/material/colors';

export const theme = createTheme({
  palette: {
    primary: {
      main: blue[800],
    },
    background: {
      default: '#f5f5f5',
    },
  },
});
```

- [ ] **Step 3: Replace `src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { theme } from './theme';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>
);
```

- [ ] **Step 4: Commit**

```bash
git add src/types.ts src/theme.ts src/main.tsx
git commit -m "feat: add shared types and MUI theme"
```

---

## Task 3: storageService (TDD)

**Files:**
- Create: `src/services/storageService.ts`, `src/services/storageService.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/services/storageService.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests — expect failures**

```bash
npm test -- --run src/services/storageService.test.ts
```

Expected: All tests fail with `Cannot find module './storageService'`.

- [ ] **Step 3: Implement `src/services/storageService.ts`**

```typescript
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
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
npm test -- --run src/services/storageService.test.ts
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/services/storageService.ts src/services/storageService.test.ts
git commit -m "feat: storageService with 7-day rolling expiry"
```

---

## Task 4: soundService

**Files:**
- Create: `src/services/soundService.ts`

No unit tests — Web Audio API is not available in jsdom. Tested manually on device.

- [ ] **Step 1: Create `src/services/soundService.ts`**

```typescript
let ctx: AudioContext | null = null;

function getContext(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    document.addEventListener(
      'touchstart',
      () => ctx?.state === 'suspended' && ctx.resume(),
      { once: true }
    );
  }
  return ctx;
}

export function beep(): void {
  const context = getContext();
  if (context.state === 'suspended') return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.type = 'sine';
  oscillator.frequency.value = 440;
  gain.gain.value = 0.3;
  oscillator.start();
  oscillator.stop(context.currentTime + 0.08);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/soundService.ts
git commit -m "feat: soundService Web Audio API beep with iOS resume"
```

---

## Task 5: barcodeService (TDD)

**Files:**
- Create: `src/services/barcodeService.ts`, `src/services/barcodeService.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/services/barcodeService.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests — expect failures**

```bash
npm test -- --run src/services/barcodeService.test.ts
```

Expected: All tests fail with `Cannot find module './barcodeService'`.

- [ ] **Step 3: Implement `src/services/barcodeService.ts`**

```typescript
import type { ScanResult } from '../types';

async function lookupOpenFoodFacts(
  barcode: string,
  signal: AbortSignal
): Promise<ScanResult> {
  const res = await fetch(
    `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
    { signal }
  );
  const data = await res.json();
  if (data.status === 1 && data.product?.product_name) {
    return {
      status: 'found',
      name: data.product.product_name as string,
      brand: data.product.brands as string | undefined,
      source: 'openfoodfacts',
    };
  }
  return { status: 'not_found' };
}

async function lookupUPCItemDB(
  barcode: string,
  signal: AbortSignal
): Promise<ScanResult> {
  const res = await fetch(
    `https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`,
    { signal }
  );
  const data = await res.json();
  const item = (data.items as Array<{ title?: string; brand?: string }>)?.[0];
  if (item?.title) {
    return {
      status: 'found',
      name: item.title,
      brand: item.brand,
      source: 'upcitemdb',
    };
  }
  return { status: 'not_found' };
}

async function lookupOpenEAN(
  barcode: string,
  signal: AbortSignal
): Promise<ScanResult> {
  const res = await fetch(
    `https://opengtindb.org/?ean=${barcode}&cmd=wsgetfull&lang=en`,
    { signal }
  );
  const text = await res.text();
  const nameMatch = text.match(/name=([^\n|<]+)/i);
  const name = nameMatch?.[1]?.trim();
  if (name) {
    return { status: 'found', name, source: 'openean' };
  }
  return { status: 'not_found' };
}

// Policy: soft failures (no name in response) → not_found; all-hard-reject (fetch throws) → error
function raceToSuccess(
  fetchers: Array<(signal: AbortSignal) => Promise<ScanResult>>,
  controllers: AbortController[]
): Promise<ScanResult> {
  return new Promise((resolve, reject) => {
    let resolved = false;
    let settled = 0;
    let hardFailures = 0;
    let firstError: Error | null = null;

    fetchers.forEach((fetcher, i) => {
      fetcher(controllers[i].signal)
        .then((result) => {
          settled++;
          if (resolved) return;
          if (result.status === 'found') {
            resolved = true;
            controllers.forEach((c, j) => { if (j !== i) c.abort(); });
            resolve(result);
          } else if (settled === fetchers.length) {
            // All fetchers settled; none returned 'found'.
            // If every single fetcher threw a hard error (no "no result" response),
            // propagate a rejection so the try/catch in lookup() returns { status: 'error' }.
            // Otherwise at least one fetcher responded (even with no name), which is
            // enough to confirm the product is not in any DB → not_found.
            if (hardFailures === fetchers.length) {
              reject(firstError ?? new Error('All fetchers failed'));
            } else {
              resolve({ status: 'not_found' });
            }
          }
        })
        .catch((e: unknown) => {
          settled++;
          hardFailures++;
          if (!firstError) {
            firstError = e instanceof Error ? e : new Error(String(e));
          }
          if (!resolved && settled === fetchers.length) {
            if (hardFailures === fetchers.length) {
              reject(firstError);
            } else {
              resolve({ status: 'not_found' });
            }
          }
        });
    });
  });
}

export async function lookup(barcode: string): Promise<ScanResult> {
  const controllers = Array.from({ length: 3 }, () => new AbortController());
  try {
    return await raceToSuccess(
      [
        (sig) => lookupOpenFoodFacts(barcode, sig),
        (sig) => lookupUPCItemDB(barcode, sig),
        (sig) => lookupOpenEAN(barcode, sig),
      ],
      controllers
    );
  } catch (e) {
    return { status: 'error', message: String(e) };
  }
}
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
npm test -- --run src/services/barcodeService.test.ts
```

Expected: All 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/services/barcodeService.ts src/services/barcodeService.test.ts
git commit -m "feat: barcodeService with raceToSuccess + AbortController"
```

---

## Task 6: exportService (TDD)

**Files:**
- Create: `src/services/exportService.ts`, `src/services/exportService.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/services/exportService.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests — expect failures**

```bash
npm test -- --run src/services/exportService.test.ts
```

Expected: All tests fail with `Cannot find module './exportService'`.

- [ ] **Step 3: Implement `src/services/exportService.ts`**

```typescript
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
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
npm test -- --run src/services/exportService.test.ts
```

Expected: All 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/services/exportService.ts src/services/exportService.test.ts
git commit -m "feat: exportService CSV serialization"
```

---

## Task 7: useProductList Hook (TDD)

**Files:**
- Create: `src/hooks/useProductList.ts`, `src/hooks/useProductList.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/hooks/useProductList.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests — expect failures**

```bash
npm test -- --run src/hooks/useProductList.test.ts
```

Expected: All tests fail with `Cannot find module './useProductList'`.

- [ ] **Step 3: Implement `src/hooks/useProductList.ts`**

```typescript
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
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
npm test -- --run src/hooks/useProductList.test.ts
```

Expected: All 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useProductList.ts src/hooks/useProductList.test.ts
git commit -m "feat: useProductList hook with quantity accumulation"
```

---

## Task 8: useScanner Hook

**Files:**
- Create: `src/hooks/useScanner.ts`, `src/hooks/useScanner.test.ts`

Camera stream acquisition (getUserMedia, ZXing decode loop) requires a real device — covered by manual device testing. The 3-second per-barcode deduplication cooldown is pure state logic and is unit-testable in jsdom by directly invoking the scan callback with a mocked ZXing reader.

- [ ] **Step 1: Write the failing deduplication test**

Create `src/hooks/useScanner.test.ts`:

```typescript
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock @zxing/library so jsdom does not attempt camera access
vi.mock('@zxing/library', () => ({
  BrowserMultiFormatReader: vi.fn().mockImplementation(() => ({
    decodeFromStream: vi.fn(),
    reset: vi.fn(),
  })),
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
```

- [ ] **Step 2: Run tests — expect failures**

```bash
npm test -- --run src/hooks/useScanner.test.ts
```

Expected: All tests fail with `Cannot find module './useScanner'`.

- [ ] **Step 3: Implement `src/hooks/useScanner.ts`**

```typescript
import { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserMultiFormatReader } from '@zxing/library';
import type { ScanEvent } from '../types';

export function useScanner() {
  const [lastScan, setLastScan] = useState<ScanEvent | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const recentScans = useRef<Map<string, number>>(new Map());
  const scanCounterRef = useRef(0);

  const attachVideo = useCallback((el: HTMLVideoElement | null) => {
    setVideoEl(el);
  }, []);

  useEffect(() => {
    if (!videoEl) return;

    const reader = new BrowserMultiFormatReader();
    let stream: MediaStream | null = null;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        videoEl.srcObject = stream;
        await videoEl.play();

        reader.decodeFromStream(stream, videoEl, (result) => {
          if (!result) return;
          const barcode = result.getText();
          const now = Date.now();
          const lastTime = recentScans.current.get(barcode) ?? 0;
          if (now - lastTime < 3000) return;
          recentScans.current.set(barcode, now);
          // Always produce a new object so React re-renders and App.tsx
          // useEffect([lastScan]) always re-fires, even for the same barcode.
          setLastScan({ barcode, scanId: ++scanCounterRef.current });
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        let errorMsg: string;
        if (location.protocol !== 'https:') {
          errorMsg = 'La cámara requiere HTTPS. Accedé desde la URL segura de la app.';
        } else if (/NotAllowed|Permission/i.test(msg)) {
          errorMsg = 'Permiso de cámara denegado. Habilitalo en Ajustes.';
        } else if (/NotFound|Overconstrained/i.test(msg)) {
          errorMsg = 'No se encontró cámara trasera en este dispositivo.';
        } else {
          errorMsg = `Error de cámara: ${msg}`;
        }
        setCameraError(errorMsg);
      }
    })();

    return () => {
      reader.reset();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [videoEl]);

  return { lastScan, cameraError, attachVideo };
}
```

- [ ] **Step 4: Run tests after implementation — expect all pass**

```bash
npm test -- --run src/hooks/useScanner.test.ts
```

Expected: All 3 tests pass.

- [ ] **Step 5: Verify ZXing API types compile cleanly**

`@zxing/library` has had breaking API changes between versions (e.g., `decodeFromStream` vs `decodeFromVideoDevice`). Run the TypeScript compiler to confirm no type errors against the installed version:

```bash
npx tsc --noEmit
```

Expected: No errors. If TypeScript reports that `decodeFromStream` does not exist on `BrowserMultiFormatReader`, check `node_modules/@zxing/library` for the correct method name and update `useScanner.ts` accordingly. Also confirm the installed version in `package.json` matches what was specified during install.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useScanner.ts src/hooks/useScanner.test.ts
git commit -m "feat: useScanner hook with ZXing, deduplication, and camera error handling"
```


---

## Task 9: ScannerView Component

**Files:**
- Create: `src/components/ScannerView.tsx`

- [ ] **Step 1: Create `src/components/ScannerView.tsx`**

```tsx
import { Box, Alert } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';

const styles: Record<string, SxProps<Theme>> = {
  cameraContainer: {
    position: 'relative',
    bgcolor: '#111',
    width: '100%',
    aspectRatio: '16 / 9',
    overflow: 'hidden',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  viewfinder: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '60%',
    maxWidth: 240,
    aspectRatio: '3 / 2',
    border: '2px solid',
    borderColor: 'primary.light',
    borderRadius: 1,
    pointerEvents: 'none',
  },
  hint: {
    position: 'absolute',
    bottom: 8,
    width: '100%',
    textAlign: 'center',
    color: 'grey.500',
    fontSize: '0.7rem',
    pointerEvents: 'none',
  },
  errorContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    p: 3,
    width: '100%',
    minHeight: 120,
    bgcolor: '#111',
  },
};

interface Props {
  cameraError: string | null;
  attachVideo: (el: HTMLVideoElement | null) => void;
}

export function ScannerView({ cameraError, attachVideo }: Props) {
  if (cameraError) {
    return (
      <Box sx={styles.errorContainer}>
        <Alert severity="error" sx={{ width: '100%' }}>
          {cameraError}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={styles.cameraContainer}>
      <Box
        component="video"
        ref={attachVideo}
        sx={styles.video}
        muted
        playsInline
      />
      <Box sx={styles.viewfinder} />
      <Box sx={styles.hint}>Apuntá el código entre 10–30 cm</Box>
    </Box>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ScannerView.tsx
git commit -m "feat: ScannerView with viewfinder overlay and camera error display"
```

---

## Task 10: ClearDialog Component

**Files:**
- Create: `src/components/ClearDialog.tsx`

- [ ] **Step 1: Create `src/components/ClearDialog.tsx`**

```tsx
import {
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button,
} from '@mui/material';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ClearDialog({ open, onClose, onConfirm }: Props) {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>¿Limpiar lista?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Se borrarán todos los productos escaneados. Esta acción no se puede deshacer.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button onClick={onConfirm} color="error" variant="contained" autoFocus>
          Limpiar lista
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ClearDialog.tsx
git commit -m "feat: ClearDialog MUI confirmation dialog"
```

---

## Task 11: ProductList Component

**Files:**
- Create: `src/components/ProductList.tsx`

- [ ] **Step 1: Create `src/components/ProductList.tsx`**

```tsx
import { useState } from 'react';
import {
  List, ListItem, ListItemText, Chip, Box, Button, Typography,
} from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import { ClearDialog } from './ClearDialog';
import type { ScanItem } from '../types';

const styles: Record<string, SxProps<Theme>> = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    px: 2,
    py: 1,
    borderBottom: 1,
    borderColor: 'divider',
  },
  label: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: 'text.secondary',
  },
  listItem: {
    borderBottom: 1,
    borderColor: 'divider',
    '&:last-child': { borderBottom: 0 },
  },
  empty: {
    py: 4,
    textAlign: 'center',
    color: 'text.disabled',
  },
};

interface Props {
  items: ScanItem[];
  onClear: () => void;
}

export function ProductList({ items, onClear }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const sorted = [...items].sort(
    (a, b) => new Date(b.lastScanned).getTime() - new Date(a.lastScanned).getTime()
  );

  return (
    <>
      <Box sx={styles.header}>
        <Typography variant="caption" sx={styles.label}>
          Productos escaneados
        </Typography>
        <Button
          size="small"
          color="error"
          onClick={() => setDialogOpen(true)}
          disabled={items.length === 0}
        >
          Limpiar
        </Button>
      </Box>

      {items.length === 0 ? (
        <Typography sx={styles.empty}>Aún no escaneaste ningún producto.</Typography>
      ) : (
        <List disablePadding>
          {sorted.map((item) => (
            <ListItem
              key={item.barcode}
              sx={styles.listItem}
              secondaryAction={
                <Chip
                  label={`×${item.quantity}`}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              }
            >
              <ListItemText
                primary={item.name}
                secondary={`${item.barcode}${item.source ? ` · ${item.source}` : ''}`}
                primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                secondaryTypographyProps={{ variant: 'caption' }}
              />
            </ListItem>
          ))}
        </List>
      )}

      <ClearDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onConfirm={() => {
          onClear();
          setDialogOpen(false);
        }}
      />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ProductList.tsx
git commit -m "feat: ProductList with quantity badges and ClearDialog"
```

---

## Task 12: Toast Component

**Files:**
- Create: `src/components/Toast.tsx`

- [ ] **Step 1: Create `src/components/Toast.tsx`**

`ToastData` is defined in `src/types.ts` (Task 2). `App.tsx` converts `ScanResult → ToastData` adding barcode context before passing it here.

```tsx
import { Snackbar, Alert } from '@mui/material';
import type { ToastData } from '../types';

interface Props {
  data: ToastData | null;
  onClose: () => void;
}

export function Toast({ data, onClose }: Props) {
  if (!data) return null;

  const severity =
    data.status === 'found' ? 'success'
    : data.status === 'not_found' ? 'warning'
    : 'error';

  const message =
    data.status === 'found'
      ? data.name
      : data.status === 'not_found'
      ? `Código ${data.barcode} — sin descripción`
      : 'Error al buscar — volvé a intentar';

  const autoHideDuration = data.status === 'found' ? 2500 : null;

  return (
    <Snackbar
      open
      autoHideDuration={autoHideDuration}
      onClose={onClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
    >
      <Alert severity={severity} onClose={onClose} sx={{ width: '100%' }}>
        {message}
      </Alert>
    </Snackbar>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Toast.tsx
git commit -m "feat: Toast component with auto-dismiss for success and persist for errors"
```

---

## Task 13: ExportButton Component

**Files:**
- Create: `src/components/ExportButton.tsx`

- [ ] **Step 1: Create `src/components/ExportButton.tsx`**

```tsx
import { Button } from '@mui/material';
import ShareIcon from '@mui/icons-material/Share';
import type { SxProps, Theme } from '@mui/material';
import { buildCSVFile } from '../services/exportService';
import type { ScanItem } from '../types';

const styles: Record<string, SxProps<Theme>> = {
  button: { mt: 1 },
};

interface Props {
  items: ScanItem[];
}

export function ExportButton({ items }: Props) {
  const handleShare = async () => {
    // exportService defensive invariant: returns empty File for empty list
    const file = buildCSVFile(items);

    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Lista de productos' });
      } catch {
        // User cancelled share — not an error condition
      }
    } else {
      // Fallback: direct browser download
      const url = URL.createObjectURL(file);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'lista-productos.csv';
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    }
  };

  return (
    <Button
      variant="contained"
      fullWidth
      startIcon={<ShareIcon />}
      onClick={handleShare}
      disabled={items.length === 0}
      sx={styles.button}
    >
      Compartir lista
    </Button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ExportButton.tsx
git commit -m "feat: ExportButton with Web Share API and download fallback"
```

---

## Task 14: App.tsx Orchestrator

**Files:**
- Modify: `src/App.tsx`
- Create: `src/App.test.tsx`

- [ ] **Step 1: Replace `src/App.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { AppBar, Box, Container, Paper, Toolbar, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import { ScannerView } from './components/ScannerView';
import { ProductList } from './components/ProductList';
import { Toast } from './components/Toast';
import { ExportButton } from './components/ExportButton';
import { useScanner } from './hooks/useScanner';
import { useProductList } from './hooks/useProductList';
import { lookup } from './services/barcodeService';
import { beep } from './services/soundService';
import type { ToastData } from './types';

const styles: Record<string, SxProps<Theme>> = {
  root: { minHeight: '100vh', bgcolor: 'background.default', pb: 2 },
  itemCount: { opacity: 0.8 },
  exportBox: { px: 2, pb: 2 },
};

export function App() {
  const { lastScan, cameraError, attachVideo } = useScanner();
  const { items, addItem, clearItems } = useProductList();
  const [toastData, setToastData] = useState<ToastData | null>(null);

  useEffect(() => {
    if (!lastScan) return;
    const { barcode } = lastScan;
    let cancelled = false;

    // Beep immediately — before async lookup (per spec §3)
    beep();

    lookup(barcode).then((result) => {
      if (cancelled) return;
      if (result.status === 'found') {
        addItem({ barcode, name: result.name, brand: result.brand, source: result.source });
        setToastData({ status: 'found', name: result.name });
      } else if (result.status === 'not_found') {
        addItem({ barcode, name: `Producto desconocido (${barcode})` });
        setToastData({ status: 'not_found', barcode });
      } else {
        // error: do not add item to list
        setToastData({ status: 'error' });
      }
    });
    return () => { cancelled = true; };
  }, [lastScan]); // eslint-disable-line react-hooks/exhaustive-deps -- only re-run on new scan event; service fns are stable singletons

  return (
    <Box sx={styles.root}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            BarcodeList
          </Typography>
          <Typography variant="caption" sx={styles.itemCount}>
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="sm" disableGutters>
        <Paper elevation={0} square>
          <ScannerView cameraError={cameraError} attachVideo={attachVideo} />
        </Paper>

        <Paper sx={{ mt: 1 }}>
          <ProductList items={items} onClear={clearItems} />
          <Box sx={styles.exportBox}>
            <ExportButton items={items} />
          </Box>
        </Paper>
      </Container>

      <Toast data={toastData} onClose={() => setToastData(null)} />
    </Box>
  );
}
```

- [ ] **Step 2: Write App.tsx integration test**

Create `src/App.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThemeProvider } from '@mui/material';
import { theme } from './theme';

// Mock hooks and services so no camera or network access occurs
vi.mock('./hooks/useScanner', () => ({
  useScanner: vi.fn(() => ({ lastScan: null, cameraError: null, attachVideo: vi.fn() })),
}));
vi.mock('./hooks/useProductList', () => ({
  useProductList: vi.fn(() => ({ items: [], addItem: vi.fn(), clearItems: vi.fn() })),
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
    mockUseProductList.mockReturnValue({ items: [], addItem, clearItems: vi.fn() });
  });

  it('renders AppBar with title', () => {
    mockUseScanner.mockReturnValue({ lastScan: null, cameraError: null, attachVideo: vi.fn() });
    renderApp();
    expect(screen.getByText('BarcodeList')).toBeInTheDocument();
  });

  it('calls beep before lookup resolves, then addItem on found result', async () => {
    let resolveLookup!: (v: unknown) => void;
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
```

- [ ] **Step 3: Run integration tests**

```bash
npm test -- --run src/App.test.tsx
```

Expected: All 4 tests pass.

- [ ] **Step 4: Run all tests to confirm nothing broken**

```bash
npm test -- --run
```

Expected: All tests pass.

- [ ] **Step 5: Start dev server and do a smoke test in browser**

```bash
npm run dev
```

Open `http://localhost:5173/barcode-list/` in a browser. Confirm:
- App loads without console errors
- AppBar shows "BarcodeList"
- Camera viewfinder appears (or camera error if denied)
- Empty list state shows placeholder text
- "Compartir lista" button is disabled

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat: App.tsx orchestrator — beep → lookup → addItem → toast"
```

---

## Task 15: GitHub Actions Deployment

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create `.github/workflows/deploy.yml`**

```bash
mkdir -p .github/workflows
```

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: write

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test -- --run

      - name: Build
        run: npm run build

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

- [ ] **Step 2: Update `vite.config.ts` — confirm base path**

The `base: '/barcode-list/'` must match your GitHub repo name exactly. If your repo name is different, update `base` in `vite.config.ts` to `/your-repo-name/`.

- [ ] **Step 3: Run a production build locally to confirm it succeeds**

```bash
npm run build
```

Expected: `dist/` directory created with bundled assets, no TypeScript errors.

- [ ] **Step 4: Commit and push**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: GitHub Actions deploy to GitHub Pages"
```

Push to `main` (requires a GitHub remote with GitHub Pages enabled on the `gh-pages` branch):

```bash
git remote add origin https://github.com/<your-username>/barcode-list.git
git push -u origin main
```

- [ ] **Step 5: Enable GitHub Pages in repo settings**

In your GitHub repo: Settings → Pages → Source → `gh-pages` branch → `/` (root) → Save.

The app will be live at `https://<your-username>.github.io/barcode-list/` within ~2 minutes of the Action completing.

---

## Manual Device Testing Checklist

After deploying, test from iPhone (Safari) and Android (Chrome):

- [ ] App loads over HTTPS without errors
- [ ] Camera permission prompt appears on first visit
- [ ] Camera feed displays in the viewfinder area
- [ ] Scanning a real barcode (EAN-13 from a food package) triggers a beep
- [ ] Product name appears in the toast (green, auto-dismisses)
- [ ] Product appears in the list with `×1` badge
- [ ] Scanning the same barcode again increments to `×2`
- [ ] Unknown barcode shows orange toast (persists until tapped)
- [ ] "Limpiar" button opens confirmation dialog
- [ ] Confirming clears the list
- [ ] "Compartir lista" button is disabled on empty list
- [ ] After scanning items, "Compartir lista" opens native share sheet on iOS
- [ ] Selecting Google Drive / Files from share sheet transfers the CSV
- [ ] Closing browser and reopening preserves the list
- [ ] List is gone after 7 days of inactivity (or manually verifiable via DevTools: set `expiresAt` to a past date in localStorage)
