import { useEffect, useState, useRef, useCallback } from 'react';
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
import { getOverride } from './services/descriptionCache';
import type { ToastData } from './types';

const styles: Record<string, SxProps<Theme>> = {
  root: { minHeight: '100vh', bgcolor: 'background.default', pb: 2 },
  itemCount: { opacity: 0.8 },
  exportBox: { px: 2, pb: 2 },
};

export function App() {
  const { lastScan, cameraError, attachVideo, zoomLevel, zoomRange, setZoom } = useScanner();
  const { items, addItem, clearItems, editItemName } = useProductList();
  const [toastData, setToastData] = useState<ToastData | null>(null);
  const [scanningBarcode, setScanningBarcode] = useState<string | null>(null);
  // Generation counter: incremented on clear so in-flight lookups discard their results
  const genRef = useRef(0);

  useEffect(() => {
    if (!lastScan) return;
    const gen = ++genRef.current;
    const { barcode } = lastScan;

    setScanningBarcode(barcode);
    beep();

    lookup(barcode).then((result) => {
      if (genRef.current !== gen) return; // cleared or superseded
      setScanningBarcode(null);

      const override = getOverride(barcode);
      if (result.status === 'found') {
        const name = override ?? result.name;
        addItem({ barcode, name, brand: result.brand, source: result.source });
        setToastData({ status: 'found', name });
      } else if (result.status === 'not_found') {
        const name = override ?? `Producto desconocido (${barcode})`;
        addItem({ barcode, name });
        setToastData({ status: 'not_found', barcode });
      } else {
        setToastData({ status: 'error' });
      }
    });

    return () => { setScanningBarcode(null); };
  }, [lastScan]); // eslint-disable-line react-hooks/exhaustive-deps -- only re-run on new scan event; service fns are stable singletons

  const handleClear = useCallback(() => {
    genRef.current++; // invalidate any in-flight lookups
    setScanningBarcode(null);
    clearItems();
  }, [clearItems]);

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
          <ScannerView
            cameraError={cameraError}
            attachVideo={attachVideo}
            scanningBarcode={scanningBarcode}
            zoomLevel={zoomLevel}
            zoomRange={zoomRange}
            setZoom={setZoom}
          />
        </Paper>

        <Paper sx={{ mt: 1 }}>
          <ProductList items={items} onClear={handleClear} onEditName={editItemName} />
          <Box sx={styles.exportBox}>
            <ExportButton items={items} />
          </Box>
        </Paper>
      </Container>

      <Toast data={toastData} onClose={() => setToastData(null)} />
    </Box>
  );
}
