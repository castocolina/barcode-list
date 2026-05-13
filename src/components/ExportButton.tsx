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
