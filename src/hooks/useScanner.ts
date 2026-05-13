import { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserMultiFormatReader } from '@zxing/library';
import type { ScanEvent, ZoomRange } from '../types';

// iOS 17+ / Chrome extensions to the standard MediaTrack types
interface ExtendedCapabilities extends MediaTrackCapabilities {
  zoom?: { min: number; max: number; step: number };
}
interface ExtendedConstraintSet extends MediaTrackConstraintSet {
  zoom?: number;
}

const ZOOM_KEY = 'bl_zoom';

export function useScanner() {
  const [lastScan, setLastScan] = useState<ScanEvent | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [zoomRange, setZoomRange] = useState<ZoomRange | null>(null);
  const recentScans = useRef<Map<string, number>>(new Map());
  const scanCounterRef = useRef(0);
  const trackRef = useRef<MediaStreamTrack | null>(null);

  const attachVideo = useCallback((el: HTMLVideoElement | null) => {
    setVideoEl(el);
  }, []);

  const setZoom = useCallback(async (value: number) => {
    const track = trackRef.current;
    if (!track) return;
    // Optimistic update so the button feels instant
    setZoomLevel(value);
    localStorage.setItem(ZOOM_KEY, String(value));
    try {
      await track.applyConstraints({ advanced: [{ zoom: value } as ExtendedConstraintSet] });
    } catch { /* ignore — device may not support this exact value */ }
  }, []);

  useEffect(() => {
    if (!videoEl) return;

    const reader = new BrowserMultiFormatReader();
    let stream: MediaStream | null = null;
    let cancelled = false;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        // Zoom capability (iOS 17+, some Android)
        const track = (stream?.getVideoTracks?.() ?? [])[0] ?? null;
        trackRef.current = track;
        if (track) {
          const caps = track.getCapabilities() as ExtendedCapabilities;
          if (caps.zoom && typeof caps.zoom.min === 'number') {
            const range: ZoomRange = {
              min: caps.zoom.min,
              max: caps.zoom.max,
              step: caps.zoom.step ?? 0.01,
            };
            setZoomRange(range);
            const saved = parseFloat(localStorage.getItem(ZOOM_KEY) ?? '');
            const initial =
              !isNaN(saved) && saved >= range.min && saved <= range.max
                ? saved
                : range.min;
            if (initial !== range.min) {
              await track.applyConstraints({
                advanced: [{ zoom: initial } as ExtendedConstraintSet],
              });
            }
            setZoomLevel(initial);
          }
        }

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
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        let errorMsg: string;
        if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
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
      cancelled = true;
      trackRef.current = null;
      reader.reset();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [videoEl]);

  return { lastScan, cameraError, attachVideo, zoomLevel, zoomRange, setZoom };
}
