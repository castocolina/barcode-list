import { useState } from 'react';
import {
  List, ListItem, ListItemText, Chip, Box, Button, Typography,
  IconButton, TextField,
} from '@mui/material';
import {
  Edit as EditIcon,
  Check as CheckIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
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
  secondaryActions: {
    display: 'flex',
    gap: 0.5,
    alignItems: 'center',
  },
  editActions: {
    display: 'flex',
    gap: 0.5,
  },
};

interface Props {
  items: ScanItem[];
  onClear: () => void;
  onEditName: (barcode: string, name: string) => void;
}

export function ProductList({ items, onClear, onEditName }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBarcode, setEditingBarcode] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  function startEdit(item: ScanItem) {
    setEditingBarcode(item.barcode);
    setEditValue(item.name);
  }

  function saveEdit() {
    if (editingBarcode && editValue.trim()) {
      onEditName(editingBarcode, editValue.trim());
    }
    setEditingBarcode(null);
  }

  function cancelEdit() {
    setEditingBarcode(null);
  }

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
          {sorted.map((item) => {
            const isEditing = editingBarcode === item.barcode;
            return (
              <ListItem
                key={item.barcode}
                sx={styles.listItem}
                secondaryAction={
                  isEditing ? (
                    <Box sx={styles.editActions}>
                      <IconButton size="small" color="success" onClick={saveEdit} aria-label="guardar">
                        <CheckIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={cancelEdit} aria-label="cancelar">
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ) : (
                    <Box sx={styles.secondaryActions}>
                      <IconButton size="small" onClick={() => startEdit(item)} sx={{ opacity: 0.45 }} aria-label="editar">
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <Chip
                        label={`×${item.quantity}`}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    </Box>
                  )
                }
              >
                {isEditing ? (
                  <TextField
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit();
                      if (e.key === 'Escape') cancelEdit();
                    }}
                    size="small"
                    autoFocus
                    sx={{ pr: 11, width: '100%' }}
                  />
                ) : (
                  <ListItemText
                    primary={item.name}
                    secondary={`${item.barcode}${item.source ? ` · ${item.source}` : ''}`}
                    primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                )}
              </ListItem>
            );
          })}
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
