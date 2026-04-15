import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { ThemeProvider } from '@mui/material/styles';
import { Toaster } from 'sonner'; // <-- 1. Importar Sonner
import { store } from './app/store';
import { theme } from './theme/AppTheme';
import { AppRouter } from './router/AppRouter';
//import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        {/* 2. Añadir el Toaster global (richColors le da colores vivos al éxito/error) */}
        <Toaster duration={3000} position="top-center" richColors />
        <AppRouter />
      </ThemeProvider>
    </Provider>
  </React.StrictMode>,
);