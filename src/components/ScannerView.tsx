import { Box, Alert, Typography } from '@mui/material';
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
    borderRadius: 1,
    pointerEvents: 'none',
    transition: 'border-color 0.15s',
  },
  hint: {
    position: 'absolute',
    bottom: 8,
    width: '100%',
    textAlign: 'center',
    fontSize: '0.7rem',
    pointerEvents: 'none',
  },
  scanIndicator: {
    position: 'absolute',
    top: 8,
    width: '100%',
    textAlign: 'center',
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
  scanningBarcode?: string | null;
}

export function ScannerView({ cameraError, attachVideo, scanningBarcode }: Props) {
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
      <Box
        sx={{
          ...styles.viewfinder,
          borderColor: scanningBarcode ? 'success.main' : 'primary.light',
        }}
      />
      {scanningBarcode ? (
        <Box sx={styles.scanIndicator}>
          <Typography variant="caption" sx={{ color: 'success.light', fontWeight: 600, textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
            ● Buscando {scanningBarcode}
          </Typography>
        </Box>
      ) : null}
      <Box sx={{ ...styles.hint, color: scanningBarcode ? 'transparent' : 'grey.500' }}>
        Apuntá el código entre 10–30 cm
      </Box>
    </Box>
  );
}
