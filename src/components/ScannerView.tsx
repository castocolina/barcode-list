import { Box, Alert, Typography, IconButton } from '@mui/material';
import { Add as AddIcon, Remove as RemoveIcon } from '@mui/icons-material';
import type { SxProps, Theme } from '@mui/material';
import type { ZoomRange } from '../types';

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
    borderRadius: 1,
    pointerEvents: 'none',
    transition: 'border-color 0.15s',
  },
  scanIndicator: {
    position: 'absolute',
    top: 8,
    width: '100%',
    textAlign: 'center',
    pointerEvents: 'none',
  },
  zoomControls: {
    position: 'absolute',
    bottom: 8,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    gap: 0.5,
    bgcolor: 'rgba(0,0,0,0.55)',
    borderRadius: 3,
    px: 0.5,
    py: 0.25,
  },
  zoomButton: {
    color: 'white',
    '&:disabled': { color: 'rgba(255,255,255,0.25)' },
  },
  zoomLabel: {
    color: 'white',
    minWidth: 36,
    textAlign: 'center',
    fontSize: '0.75rem',
    fontWeight: 600,
    letterSpacing: 0.2,
  },
  hint: {
    position: 'absolute',
    bottom: 8,
    width: '100%',
    textAlign: 'center',
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

const BUTTON_STEP = 0.5;

interface Props {
  cameraError: string | null;
  attachVideo: (el: HTMLVideoElement | null) => void;
  scanningBarcode?: string | null;
  zoomLevel?: number;
  zoomRange?: ZoomRange | null;
  setZoom?: (value: number) => void;
}

export function ScannerView({
  cameraError,
  attachVideo,
  scanningBarcode,
  zoomLevel = 1,
  zoomRange,
  setZoom,
}: Props) {
  if (cameraError) {
    return (
      <Box sx={styles.errorContainer}>
        <Alert severity="error" sx={{ width: '100%' }}>
          {cameraError}
        </Alert>
      </Box>
    );
  }

  function adjustZoom(delta: number) {
    if (!zoomRange || !setZoom) return;
    const nativeStep = zoomRange.step;
    const raw = zoomLevel + delta * Math.max(BUTTON_STEP, nativeStep);
    const clamped = Math.max(zoomRange.min, Math.min(zoomRange.max, raw));
    // Round to avoid floating-point drift
    const rounded = Math.round(clamped / nativeStep) * nativeStep;
    setZoom(rounded);
  }

  const zoomDisplay =
    zoomRange && zoomRange.step >= 1
      ? `${Math.round(zoomLevel)}×`
      : `${zoomLevel.toFixed(1)}×`;

  return (
    <Box sx={styles.cameraContainer}>
      <Box
        component="video"
        ref={attachVideo}
        sx={styles.video}
        muted
        playsInline
      />
      <Box
        sx={{
          ...styles.viewfinder,
          borderColor: scanningBarcode ? 'success.main' : 'primary.light',
        }}
      />

      {scanningBarcode ? (
        <Box sx={styles.scanIndicator}>
          <Typography
            variant="caption"
            sx={{ color: 'success.light', fontWeight: 600, textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
          >
            ● Buscando {scanningBarcode}
          </Typography>
        </Box>
      ) : null}

      {zoomRange ? (
        <Box sx={styles.zoomControls}>
          <IconButton
            size="small"
            sx={styles.zoomButton}
            onClick={() => adjustZoom(-1)}
            disabled={zoomLevel <= zoomRange.min}
            aria-label="alejar"
          >
            <RemoveIcon fontSize="small" />
          </IconButton>
          <Typography sx={styles.zoomLabel}>{zoomDisplay}</Typography>
          <IconButton
            size="small"
            sx={styles.zoomButton}
            onClick={() => adjustZoom(1)}
            disabled={zoomLevel >= zoomRange.max}
            aria-label="acercar"
          >
            <AddIcon fontSize="small" />
          </IconButton>
        </Box>
      ) : (
        <Box sx={{ ...styles.hint, color: scanningBarcode ? 'transparent' : 'grey.500' }}>
          Apuntá el código entre 10–30 cm
        </Box>
      )}
    </Box>
  );
}
