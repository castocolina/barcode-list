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
