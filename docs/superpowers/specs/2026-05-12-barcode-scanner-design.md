# Barcode Scanner Web App — Design Spec

**Date:** 2026-05-12  
**Status:** Approved  
**Deploy target:** GitHub Pages (`username.github.io/barcode-list`)

---

## Overview

A mobile-first progressive web app that scans product barcodes via the phone camera, looks up product descriptions from three free public APIs in parallel, accumulates a persistent list, and allows the user to share/export the list via the native OS share sheet.

Primary use case: personal grocery/supermarket scanning on iPhone (also works on Android Chrome).

---

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + Vite + TypeScript |
| UI | MUI v7 (`@mui/material`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled`) |
| Barcode scanning | `@zxing/library` |
| Styling | `sx` prop with MUI theme tokens — no hardcoded colors |
| Persistence | `localStorage` |
| Export | Web Share API (native OS share sheet) |
| Hosting | GitHub Pages via GitHub Actions |

---

## Architecture

Pure static client-side app — no backend, no server, no authentication. All logic runs in the browser.

```
src/
  components/
    ScannerView.tsx       # rendering only: video element, viewfinder overlay, and cameraError display (renders MUI Alert when cameraError is set)
    ProductList.tsx       # MUI List of scanned items
    Toast.tsx             # Snackbar/Alert wrapper (success vs error behavior)
    ClearDialog.tsx       # MUI Dialog confirmation for clearing list
    ExportButton.tsx      # Web Share API trigger (delegates CSV construction to exportService); owns the fallback download path — if `navigator.share` or file sharing is unsupported, `ExportButton.tsx` constructs an `<a>` element, sets `href` to an object URL, and programmatically clicks it to trigger a direct browser download
  services/
    barcodeService.ts     # parallel API lookup logic (raceToSuccess + AbortController)
    storageService.ts     # localStorage read/write/expiry (owns the on-load expiry check; exposes a dedicated `checkAndClearIfExpired()` function that `useProductList` calls explicitly on mount before any reads — `getItems()` does not perform the expiry check autonomously)
    soundService.ts       # Web Audio API beep (owns AudioContext lifecycle + iOS resume)
    exportService.ts      # CSV serialization + file construction (no UI logic)
  hooks/
    useScanner.ts         # ZXing lifecycle, camera stream acquisition, deduplication; exposes `{ lastScan: ScanEvent | null, cameraError: string | null, attachVideo: (el: HTMLVideoElement | null) => void }` — `lastScan` is `null` on mount and set to `{ barcode: string, scanId: number }` (a new object per accepted scan so React's `useEffect` always re-fires, even for repeated barcodes after the cooldown). `attachVideo` is called by `ScannerView` to register the video element with ZXing. `App.tsx`'s useEffect guards with `if (!lastScan) return` as its first statement before extracting `barcode = lastScan.barcode` and calling beep or lookup. `ScanEvent` is defined in `types.ts` and imported by `useScanner`.
    useProductList.ts     # list state + localStorage sync (calls storageService for all reads/writes; does not own expiry logic)
  App.tsx                 # orchestrates useScanner output → soundService.beep() (before await) → await barcodeService.lookup() → useProductList.addItem() → Toast display
  main.tsx
  theme.ts                # MUI theme (primary: blue[800])
```

---

## Features (MVP)

### 1. Camera Scanner

- Rear camera (`facingMode: 'environment'`)
- Continuous autofocus — all browsers on iOS (Safari, Chrome for iOS, Firefox for iOS) use WebKit due to Apple's App Store policy, and WebKit does not expose manual camera focus control via the Web API. Continuous autofocus works reliably for barcodes at 10–30 cm.
- ZXing-js decodes frames continuously
- Visual viewfinder overlay with corner guides rendered over the video element
- **Deduplication:** each barcode has its own independent 3-second cooldown — detecting the same barcode again within 3s of its last scan is ignored (prevents double-scan from hand tremor). Different barcodes are not affected by each other's cooldown.
- Supports EAN-13, EAN-8, UPC-A, UPC-E, Code 128, QR (full ZXing format set)
- **Camera error handling:** `useScanner` exposes a `cameraError: string | null` state. When camera access fails (permission denied, no rear camera available, or non-HTTPS context), `useScanner` sets `cameraError` to a descriptive message. `ScannerView.tsx` renders a centered MUI `Alert severity="error"` in place of the video element when `cameraError` is set.

### 2. Parallel Barcode Lookup

Three APIs queried simultaneously via a custom `raceToSuccess` pattern: resolves as soon as the first API returns a valid product name; the remaining in-flight requests are cancelled via `AbortController` (i.e., the HTTP request is actually aborted, not merely ignored — this is best-effort cancellation that reduces quota consumption for abandoned requests, but cannot guarantee zero server-side processing for requests already in flight when the abort fires). If all three APIs return a response but none contains a product name, the result is `not_found`. If all three APIs fail with a network or CORS error (fetch rejects), the result is `{ status: 'error' }`. If some fail and at least one returns a response with no name, the result is `not_found` (graceful degradation — a partial response is treated as a definitive miss). (`Promise.race` is not used directly because it settles on the first settled promise — a single fast-failing API would propagate a rejection before slower successful APIs respond; `Promise.allSettled` waits for all — neither matches the desired behavior.)

| API | Key required | CORS | Notes |
|-----|-------------|------|-------|
| Open Food Facts | No | ✓ | Best for food/grocery |
| UPC Item DB | No | ✓ | 100 free lookups/day |
| Open EAN DB | No | ✓ | European fallback |

> **CORS assumption:** CORS availability for all three APIs is assumed at design time based on their public documentation but cannot be verified without runtime testing. CORS failures and network errors are indistinguishable at runtime — both cause `fetch()` to reject with a `TypeError`. A rejected fetch is counted as a hard failure. If all three fetchers reject, the result is `{ status: 'error' }`. If at least one fetcher returns a response (even without a product name), the result is `not_found`.

**Winning result** provides: `name`, `brand` (optional), `source` (which API responded).

**No result:** item is added to the list as `"Producto desconocido (BARCODE)"` — the scan still counts and beeps normally.

**Error propagation contract:** `barcodeService.ts` returns a discriminated union — `{ status: 'found', name, brand, source }` | `{ status: 'not_found' }` | `{ status: 'error', message }`. It never throws. `App.tsx` observes `lastScan` from `useScanner`; when it changes (and is non-null), `App.tsx` extracts `barcode = lastScan.barcode` and proceeds. `App.tsx` calls `soundService.beep()` immediately — before the async lookup — then awaits `barcodeService.lookup(barcode)`. After the lookup resolves, `App.tsx`: (1) calls `useProductList.addItem()` for `found` (with `name`, `brand`, and `source` from the result) and `not_found` (with `name: "Producto desconocido (BARCODE)"` constructed in `App.tsx`, `brand: undefined`, and `source: undefined`) statuses, and (2) sets toast state. No item is added for `error`. `App.tsx` also passes the result to `Toast.tsx` as a prop — the Toast renders based on the result's `status`. No exceptions cross the service→component boundary.

### 3. Sound Feedback

Web Audio API — no audio files required.

- Tone: 440 Hz, duration 80 ms, sine wave, gain 0.3
- Plays immediately on barcode detection, before API lookup completes
- One beep per deduplicated scan
- **iOS `AudioContext` suspension:** iOS requires a user gesture before `AudioContext` can produce sound. On cold load, the context starts in `suspended` state. `soundService.ts` will call `AudioContext.resume()` on the first user tap anywhere on the app (via a document-level `touchstart` listener that runs once). If the context is still suspended at scan time, the beep is silently skipped — no error is thrown.

### 4. Toast Notifications (MUI Snackbar + Alert)

| Scenario | Color | Behavior |
|----------|-------|----------|
| Product found | Green (`success`) | Auto-closes after 2.5 s |
| Product not found | Orange (`warning`) | Persists — user must tap to dismiss (`autoHideDuration={null}`) |
| API error | Red (`error`) | Persists — user must tap to dismiss (`autoHideDuration={null}`) |

Example message strings: Found → product name (e.g., "Leche entera La Serenísima"); Not found → "Código {BARCODE} — sin descripción"; Error → "Error al buscar — volvé a intentar".

**In-progress (lookup) state:** No toast or spinner is shown during the window between the beep and the API response. The beep itself is the immediate feedback; the result toast appears when the lookup resolves. This is intentional — the lookup is fast enough (< 2 s on typical mobile) that a transient "Searching…" indicator is not warranted for MVP.

### 5. Product List

- MUI `List` with `ListItem`, `ListItemText`, `Chip` for quantity badge
- Items sorted by `lastScanned` descending (most recent at top)
- Each item shows: product name, barcode, source API, quantity badge (`×N`)
- **Quantity accumulation:** scanning the same barcode again increments `quantity` and updates `lastScanned` instead of adding a duplicate entry
- **Clear button:** MUI `Button` with `color="error"` in the list header — triggers `ClearDialog`
- **ClearDialog:** MUI `Dialog` with "Cancelar" / "Limpiar lista" actions. `ProductList.tsx` owns the dialog's open/closed state (local `useState`); the "Limpiar lista" confirmation triggers `useProductList.clearItems()` via a callback prop passed down from `App.tsx`.

### 6. Persistence

localStorage key: `bl_list`

```json
{
  "version": 1,
  "expiresAt": "<ISO timestamp: now + 7 days>",
  "items": [
    {
      "barcode": "7891234567890",
      "name": "Leche entera La Serenísima",
      "brand": "La Serenísima",
      "source": "openfoodfacts",
      "quantity": 2,
      "firstScanned": "<ISO timestamp>",
      "lastScanned": "<ISO timestamp>"
    }
  ]
}
```

- On app load: if `expiresAt` is in the past, the list is cleared automatically
- `expiresAt` resets to `now + 7 days` on every scan (rolling window — ensures data doesn't survive indefinitely on unused devices while keeping the list intact for active users; this is not a hard 7-day cap from first scan). `storageService.writeItems(items)` always writes `expiresAt = now + 7 days` as a side effect — callers never need to refresh the expiry separately.
- Max items: no hard limit (localStorage is ~5 MB; a typical list of hundreds of items is well within limits)
- **Storage errors:** `storageService.writeItems()` swallows `localStorage` quota errors silently in MVP (logs to console only); no UI is surfaced for storage failure. This is acceptable because in practice iOS Safari allocates at least 5 MB per origin and a typical grocery list is well under 1 MB.

### 7. Export via Web Share API

- Button at the bottom of the list: "Compartir lista" — **disabled** (not hidden) when the list has zero items (UI guard, primary enforcement point); `exportService.ts` also returns early for empty lists as a defensive invariant — both guards are intentional and the service-level guard is not dead code
- Generates a `.csv` file client-side via `exportService.ts` (no external library needed for CSV)
- `.xlsx` is out of scope for MVP — CSV only. SheetJS is not added to the dependency list.
- Calls `navigator.share({ files: [file], title: 'Lista de productos' })`
- iOS shows native share sheet: Google Drive, Archivos, WhatsApp, Mail, etc.
- Fallback: if `navigator.share` or file sharing is not supported, `ExportButton.tsx` triggers a direct browser download by constructing a temporary `<a>` element with an object URL and programmatically clicking it

CSV columns: `Barcode, Name, Brand, Quantity, First Scanned, Last Scanned, Source`

---

## Testing

- **Unit / integration tests:** Vitest + React Testing Library. Coverage targets: `barcodeService.ts` (raceToSuccess logic with mocked `fetch`), `storageService.ts` (expiry logic), `exportService.ts` (CSV output), and `useScanner` / `useProductList` hooks with mocked service responses.
- **Manual device testing:** iOS Safari (primary) and Android Chrome before each release — camera permission, beep, share sheet, and fallback download.
- No end-to-end browser automation in MVP (static app, minimal network surface).

---

## Deployment

- Vite config: `base: '/barcode-list/'` (matches GitHub repo name)
- GitHub Actions workflow on push to `main`:
  1. `npm ci`
  2. `npm run build`
  3. Deploy `dist/` to `gh-pages` branch via `peaceiris/actions-gh-pages`
- HTTPS provided automatically by GitHub Pages (required for camera access on mobile)
- `.gitignore` includes `.superpowers/`

---

## Known Limitations

- **iOS focus control:** No browser on iOS (Safari or Chrome) exposes manual camera focus via the Web API — all use WebKit. Continuous autofocus is used and works well in practice for 10–30 cm scanning.
- **UPC Item DB rate limit:** 100 free lookups/day. In normal personal use this is not a concern. If hit, the other two APIs still function.
- **localStorage scope:** Per device, per browser. The list does not sync across devices. This is acceptable for the stated use case.
- **Web Share API file support:** Requires iOS 15+ Safari or Chrome on Android. Older devices fall back to direct download.

---

## Out of Scope

- User authentication
- Multi-device sync
- Google Drive OAuth integration (replaced by native share sheet)
- Backend / server-side logic
- Offline PWA service worker (may be added later, not in MVP)
