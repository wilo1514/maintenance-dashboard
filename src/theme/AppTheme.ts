import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#004C97', // Azul estándar
    },
    secondary: {
      main: '#00bbdc', // Rojo/Rosa para acciones secundarias
    },
    background: {
      default: '#f4f6f8', // Gris muy suave para el fondo del dashboard
      paper: '#ffffff',
    },
  },
  typography: {
    h1: { fontSize: '2rem', fontWeight: 600 },
    h2: { fontSize: '1.5rem', fontWeight: 600 },
    h3: { fontSize: '1.25rem', fontWeight: 600 },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none' }, // Evita que los botones sean todo mayúsculas
      },
    },
  },
});