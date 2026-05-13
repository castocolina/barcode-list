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
      <Alert severity={severity} onClose={onClose} onClick={onClose} sx={{ width: '100%', cursor: 'pointer' }}>
        {message}
      </Alert>
    </Snackbar>
  );
}
