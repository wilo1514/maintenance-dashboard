import React, { useState, useEffect } from 'react';
import { 
  Badge, IconButton, Drawer, Box, Typography, List, ListItem, 
  ListItemButton, ListItemAvatar, Avatar, ListItemText, Divider, Chip,
  useMediaQuery, useTheme, Button
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import CloseIcon from '@mui/icons-material/Close';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import { useNavigate } from 'react-router-dom';

// 1. IMPORTAMOS TU INSTANCIA DE API (Descomentar cuando esté lista)
// import api from '../../services/api'; 

export interface NotificationPayload {
  tipo: string;
  id: number;
  notificacionId: number;
  texto: string;
  estado: string;
  fechaNotificacion: string;
  leida?: boolean;
}

const MOCK_NOTIFICATIONS: NotificationPayload[] = [
  { tipo: "SAP", id: 96831, notificacionId: 96831, texto: "Transferencia Nro.96831 - PENDIENTE", estado: "PENDIENTE", fechaNotificacion: "2026-03-09T10:16:41.18", leida: false },
  { tipo: "STEC", id: 96832, notificacionId: 96832, texto: "Transferencia Nro.96832 - APROBADO", estado: "APROBADO", fechaNotificacion: "2026-03-09T14:20:00.00", leida: false }
];

export const NotificationBell = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationPayload[]>(MOCK_NOTIFICATIONS);

  const unreadCount = notifications.filter(n => !n.leida).length;

  // ======================================================================
  // --- API REAL: CARGAR NOTIFICACIONES AL INICIAR SESIÓN ---
  // ======================================================================
  /*
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const response = await api.get('/notifications'); // Cambia la ruta por la que te dé el backend
        setNotifications(response.data);
      } catch (error) {
        console.error('Error al cargar notificaciones', error);
      }
    };
    fetchNotifications();

    // NOTA PARA EL FUTURO: Aquí es donde inicializarías tu WebSocket (ej. socket.io)
    // para escuchar nuevas notificaciones en tiempo real sin recargar la página.
    // socket.on('nueva_notificacion', (newNotif) => {
    //   setNotifications(prev => [newNotif, ...prev]);
    // });
  }, []);
  */

  const toggleDrawer = (newOpen: boolean) => () => {
    setOpen(newOpen);
  };

  const handleNotificationClick = async (transferId: number, notifId: number) => {
    // Actualización visual instantánea (Optimistic UI)
    setNotifications(prev => prev.map(n => n.notificacionId === notifId ? { ...n, leida: true } : n));
    setOpen(false);
    navigate(`/tech/transfers/${transferId}/items`);

    // ======================================================================
    // --- API REAL: MARCAR UNA NOTIFICACIÓN COMO LEÍDA ---
    // ======================================================================
    /*
    try {
      await api.patch(`/notifications/${notifId}/read`);
    } catch (error) {
      console.error('Error al marcar como leída', error);
      // Opcional: Si falla el backend, podrías revertir el color a "no leída" aquí
    }
    */
  };

  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, leida: true })));

    // ======================================================================
    // --- API REAL: MARCAR TODAS COMO LEÍDAS ---
    // ======================================================================
    /*
    try {
      await api.patch('/notifications/read-all');
    } catch (error) {
      console.error('Error al marcar todas como leídas', error);
    }
    */
  };

  const formatDateTime = (isoString: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getStatusColor = (estado: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    switch (estado) {
      case 'PENDIENTE': return 'warning';
      case 'APROBADO': return 'info';
      case 'LIQUIDADO': return 'success';
      case 'CERRADO': return 'default';
      default: return 'primary';
    }
  };

  return (
    <>
      <IconButton color="inherit" onClick={toggleDrawer(true)}>
        <Badge badgeContent={unreadCount} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>

      <Drawer anchor="right" open={open} onClose={toggleDrawer(false)} PaperProps={{ sx: { width: isMobile ? '85%' : 400 } }}>
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'primary.main', color: 'white' }}>
          <Typography variant="h6" fontWeight="bold">Notificaciones</Typography>
          <IconButton color="inherit" onClick={toggleDrawer(false)} size="small"><CloseIcon /></IconButton>
        </Box>

        {unreadCount > 0 && (
          <Box sx={{ px: 2, py: 1, display: 'flex', justifyContent: 'flex-end', borderBottom: '1px solid #eee' }}>
            <Button size="small" startIcon={<DoneAllIcon />} onClick={markAllAsRead}>Marcar todo como leído</Button>
          </Box>
        )}

        <List sx={{ p: 0 }}>
          {notifications.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}><Typography color="text.secondary">No tienes notificaciones nuevas.</Typography></Box>
          ) : (
            notifications.map((notif) => (
              <React.Fragment key={notif.notificacionId}>
                <ListItem disablePadding sx={{ backgroundColor: notif.leida ? 'transparent' : '#f0f8ff' }}>
                  <ListItemButton alignItems="flex-start" onClick={() => handleNotificationClick(notif.id, notif.notificacionId)} sx={{ p: 2 }}>
                    <ListItemAvatar><Avatar sx={{ bgcolor: notif.leida ? 'grey.400' : 'primary.main' }}><SwapHorizIcon /></Avatar></ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                          <Typography variant="subtitle2" fontWeight={notif.leida ? 'normal' : 'bold'} sx={{ pr: 2 }}>{notif.texto}</Typography>
                          {!notif.leida && <Box sx={{ width: 8, height: 8, bgcolor: 'error.main', borderRadius: '50%', mt: 0.5, flexShrink: 0 }} />}
                        </Box>
                      }
                      secondary={
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 1 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="caption" color="text.secondary">{formatDateTime(notif.fechaNotificacion)}</Typography>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <Chip size="small" label={notif.tipo} variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                              <Chip size="small" label={notif.estado} color={getStatusColor(notif.estado)} sx={{ height: 20, fontSize: '0.7rem' }} />
                            </Box>
                          </Box>
                        </Box>
                      }
                    />
                  </ListItemButton>
                </ListItem>
                <Divider component="li" />
              </React.Fragment>
            ))
          )}
        </List>
      </Drawer>
    </>
  );
};