import { useState } from 'react';
import { Box, AppBar, Toolbar, Typography, CssBaseline, Button, IconButton } from '@mui/material';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { logout, selectCurrentUser } from '../../features/auth/authSlice';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import { Sidebar } from './Sidebar';
import { NotificationBell } from './NotificationBell';
import { useAutoLogout } from '../../hooks/useAutoLogout'; // <-- 1. Importar el hook

const drawerWidth = 240;

export const MainLayout = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector(selectCurrentUser);
  const [mobileOpen, setMobileOpen] = useState(false);

  // 2. ACTIVAR EL DETECTOR DE INACTIVIDAD (Con solo llamar a esta función, la magia empieza)
  useAutoLogout();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      
      {/* --- APPBAR (Barra Superior) --- */}
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          {/* Botón Hamburguesa (Solo visible en móvil) */}
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>

          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            UMCO Mantenimiento
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'block' } }}>
              {user?.email}
            </Typography>
            <NotificationBell />
            <Button 
              color="inherit" 
              onClick={handleLogout} 
              startIcon={<LogoutIcon />}
            >
              Salir
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      {/* --- SIDEBAR (Menú Lateral) --- */}
      <Sidebar mobileOpen={mobileOpen} handleDrawerToggle={handleDrawerToggle} />

      {/* --- CONTENIDO PRINCIPAL --- */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 3 },
          // AÑADIMOS ESTAS DOS LÍNEAS PARA EL MÓVIL:
          width: { xs: '100%', sm: `calc(100% - ${drawerWidth}px)` },
          overflowX: 'hidden', // Evita que la página entera haga scroll horizontal
          
          backgroundColor: 'background.default',
          minHeight: '100vh',
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
};