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

  // --- NUEVOS ROLES APLICADOS ---
  const menuItems = {
    admin: [
      { text: 'Dashboard', path: '/dashboard', icon: <DashboardIcon /> },
      // Corregido a /admin/users para que coincida con el Router
      { text: 'Gestión Usuarios', path: '/admin/users', icon: <PeopleIcon /> }, 
    ],
    servtecnico: [ // <-- CAMBIADO DE tech A servtecnico
      { text: 'Dashboard', path: '/dashboard', icon: <DashboardIcon /> },
      { text: 'Clientes', path: '/clients', icon: <PeopleIcon /> },
      { text: 'Órdenes Servicio', path: 'tech/service-orders', icon: <BuildIcon /> },
      { text: 'Stock de Repuestos', path: 'tech/repuestos', icon: <InventoryIcon /> },
      { text: 'Transferencias', path: '/tech/transfers', icon: <SwapHorizIcon /> }, 
      { text: 'Cambiar Contraseña', path: '/tech/change-password', icon: <LockResetIcon /> },
    ],
    clientes: [ // <-- CAMBIADO DE distributor A clientes
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
        {currentMenu.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={location.pathname.includes(item.path)} // Mejorado para que pinte el menú si estás en sub-rutas
              onClick={() => {
                navigate(item.path);
                if (mobileOpen) handleDrawerToggle();
              }}
            >
              <ListItemIcon sx={{ color: location.pathname.includes(item.path) ? 'primary.main' : 'inherit' }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.text} sx={{ color: location.pathname.includes(item.path) ? 'primary.main' : 'inherit' }} />
            </ListItemButton>
          </ListItem>
        ))}
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