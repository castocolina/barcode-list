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
        // play() is best-effort: jsdom returns undefined (not a Promise),
        // and some browsers may reject it. ZXing drives the stream directly
        // so playback is not required.
        const playPromise = videoEl.play();
        if (playPromise instanceof Promise) {
          playPromise.catch(() => undefined);
        }

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
