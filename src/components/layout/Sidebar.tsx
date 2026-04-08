import {
  Box, Divider, Drawer, List, ListItem, ListItemButton,
  ListItemIcon, ListItemText, Toolbar,
} from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppSelector } from '../../app/hooks';
import { selectCurrentUser } from '../../features/auth/authSlice';

// Iconos
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import BuildIcon from '@mui/icons-material/Build';
import InventoryIcon from '@mui/icons-material/Inventory';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import LockResetIcon from '@mui/icons-material/LockReset';
// import BuildCircleIcon from '@mui/icons-material/BuildCircle'; // (Opcional si prefieres este icono para las órdenes)

const drawerWidth = 240;

interface SidebarProps {
  mobileOpen: boolean;
  handleDrawerToggle: () => void;
}

export const Sidebar = ({ mobileOpen, handleDrawerToggle }: SidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAppSelector(selectCurrentUser);
  const role = user?.role;

  // --- RUTAS CORREGIDAS CON '/' AL INICIO ---
  const menuItems = {
    admin: [
      { text: 'Dashboard', path: '/dashboard', icon: <DashboardIcon /> },
      { text: 'Gestión Usuarios', path: '/admin/users', icon: <PeopleIcon /> }, 
    ],
    servtecnico: [ 
      { text: 'Dashboard', path: '/dashboard', icon: <DashboardIcon /> },
      { text: 'Clientes', path: '/clients', icon: <PeopleIcon /> },
      { text: 'Órdenes Servicio', path: '/tech/llamadas', icon: <BuildIcon /> },
      { text: 'Stock de Repuestos', path: '/tech/repuestos', icon: <InventoryIcon /> },
      { text: 'Transferencias', path: '/tech/transfers', icon: <SwapHorizIcon /> }, 
      { text: 'Cambiar Contraseña', path: '/tech/change-password', icon: <LockResetIcon /> },
    ],
    clientes: [ 
      { text: 'Dashboard', path: '/dashboard', icon: <DashboardIcon /> },
      { text: 'Mis Pedidos', path: '/my-orders', icon: <ShoppingCartIcon /> },
    ],
  };

  const currentMenu = role ? menuItems[role as keyof typeof menuItems] || [] : [];

  const drawerContent = (
    <div>
      <Toolbar /> 
      <Divider />
      <List>
        {currentMenu.map((item) => {
          // Lógica para pintar de azul si estamos en la ruta o en una sub-ruta (ej. /tech/llamadas/new)
          const isActive = location.pathname.startsWith(item.path);

          return (
            <ListItem key={item.text} disablePadding>
              <ListItemButton
                selected={isActive} 
                onClick={() => {
                  navigate(item.path);
                  if (mobileOpen) handleDrawerToggle();
                }}
              >
                <ListItemIcon sx={{ color: isActive ? 'primary.main' : 'inherit' }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.text} sx={{ color: isActive ? 'primary.main' : 'inherit' }} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </div>
  );

  return (
    <Box component="nav" sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}>
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{ keepMounted: true }} 
        sx={{
          display: { xs: 'block', sm: 'none' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
        }}
      >
        {drawerContent}
      </Drawer>
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', sm: 'block' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
        }}
        open
      >
        {drawerContent}
      </Drawer>
    </Box>
  );
};