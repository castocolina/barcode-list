import { createTheme } from '@mui/material/styles';
import { blue } from '@mui/material/colors';

export const theme = createTheme({
  palette: {
    primary: {
      main: blue[800],
    },
    background: {
      default: '#f5f5f5',
    },
  },
});
