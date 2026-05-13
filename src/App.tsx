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
