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

export interface ZoomRange {
  min: number;
  max: number;
  step: number;
}
