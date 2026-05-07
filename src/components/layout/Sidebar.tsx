import {
  Box, Divider, Drawer, List, ListItem, ListItemButton,
  ListItemIcon, ListItemText, Toolbar,
} from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppSelector } from '../../app/hooks';
import { selectCurrentUser } from '../../features/auth/authSlice';

import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import BuildIcon from '@mui/icons-material/Build';
import InventoryIcon from '@mui/icons-material/Inventory';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import LockResetIcon from '@mui/icons-material/LockReset';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import ArticleIcon from '@mui/icons-material/Article';
import CategoryIcon from '@mui/icons-material/Category';
import ListAltIcon from '@mui/icons-material/ListAlt';

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
  const isFT1 = user?.ubicacion === '05-FT1';

  const menuItems = {
    admin: [
      { text: 'Dashboard', path: '/dashboard', icon: <DashboardIcon /> },
      { text: 'Gestion Usuarios', path: '/admin/users', icon: <PeopleIcon /> },
    ],
    servtecnico: [
      { text: 'Dashboard', path: '/dashboard', icon: <DashboardIcon /> },
      { text: 'Ordenes Servicio FT1', path: '/tech/llamadas', icon: <BuildIcon /> },
      ...(isFT1 ? [{ text: 'Bandeja Autorizaciones', path: '/tech/llamadas/aprobaciones', icon: <FactCheckIcon /> }] : []),
      ...(isFT1 ? [{ text: 'OS Otros Servicios', path: '/tech/llamadas/servicios', icon: <ListAltIcon /> }] : []),
      { text: 'Ordenes de Compra', path: '/tech/ordenes-compra', icon: <ArticleIcon /> },
      { text: 'Stock de Repuestos', path: '/tech/repuestos', icon: <InventoryIcon /> },
      { text: 'Transferencias', path: '/tech/transfers', icon: <SwapHorizIcon /> },
      ...(isFT1 ? [{ text: 'Tipos de Problema', path: '/tech/tipos-problema', icon: <CategoryIcon /> }] : []),
      { text: 'Cambiar Contrasena', path: '/tech/change-password', icon: <LockResetIcon /> },
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
