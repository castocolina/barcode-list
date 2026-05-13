import { useState } from 'react';
import {
  List, ListItem, ListItemText, Chip, Box, Button, Typography,
} from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import { ClearDialog } from './ClearDialog';
import type { ScanItem } from '../types';

const styles: Record<string, SxProps<Theme>> = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    px: 2,
    py: 1,
    borderBottom: 1,
    borderColor: 'divider',
  },
  label: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: 'text.secondary',
  },
  listItem: {
    borderBottom: 1,
    borderColor: 'divider',
    '&:last-child': { borderBottom: 0 },
  },
  empty: {
    py: 4,
    textAlign: 'center',
    color: 'text.disabled',
  },
};

interface Props {
  items: ScanItem[];
  onClear: () => void;
}

export function ProductList({ items, onClear }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const sorted = [...items].sort(
    (a, b) => new Date(b.lastScanned).getTime() - new Date(a.lastScanned).getTime()
  );

  return (
    <>
      <Box sx={styles.header}>
        <Typography variant="caption" sx={styles.label}>
          Productos escaneados
        </Typography>
        <Button
          size="small"
          color="error"
          onClick={() => setDialogOpen(true)}
          disabled={items.length === 0}
        >
          Limpiar
        </Button>
      </Box>

      {items.length === 0 ? (
        <Typography sx={styles.empty}>Aún no escaneaste ningún producto.</Typography>
      ) : (
        <List disablePadding>
          {sorted.map((item) => (
            <ListItem
              key={item.barcode}
              sx={styles.listItem}
              secondaryAction={
                <Chip
                  label={`×${item.quantity}`}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              }
            >
              <ListItemText
                primary={item.name}
                secondary={`${item.barcode}${item.source ? ` · ${item.source}` : ''}`}
                primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                secondaryTypographyProps={{ variant: 'caption' }}
              />
            </ListItem>
          ))}
        </List>
      )}

      <ClearDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onConfirm={() => {
          onClear();
          setDialogOpen(false);
        }}
      />
    </>
  );
}
