import React, { useState, useEffect, useRef } from 'react';
import { 
  Badge, IconButton, Drawer, Box, Typography, List, ListItem, 
  ListItemButton, ListItemAvatar, Avatar, ListItemText, Divider, Chip,
  useMediaQuery, useTheme, Button
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'; 
import InfoIcon from '@mui/icons-material/Info'; 
import CloseIcon from '@mui/icons-material/Close';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import { useNavigate } from 'react-router-dom';

// IMPORTAMOS SIGNALR
import * as signalR from '@microsoft/signalr';

// IMPORTAMOS LA INSTANCIA DE API
import api from '../../services/api'; 
import { useAppSelector } from '../../app/hooks';
import { selectCurrentUser } from '../../features/auth/authSlice';

export interface NotificationPayload {
  Id: number;
  Tipo: string; 
  Titulo: string;
  Mensaje: string;
  UbicacionDestino: string;
  BodegaDestino: string;
  Referencia: string;
  PayloadJson: string; 
  Estado: string;
  Leido: string | number; 
  Intentos: string | number;
  FechaEvento: string;
  FechaProceso: string;
  FechaLectura: string;
  FechaUltimoIntento: string;
  ErrorMensaje: string;
  UsuCrea: string;
  UsuFechaCrea: string;
}

// --- INTERFAZ ESTRICTA SIN "ANY" ---
export interface ParsedPayload {
  Id: number;
  Tipo: string;
  DocEntry?: number;
  DocNum?: number;
  DocDate?: string;
  BodegaDesde?: string;
  UbicacionDesde?: string;
  BodegaHasta?: string;
  UbicacionHasta?: string;
  NroInterno?: number;
  NroDocumento?: number;
  NroServicio?: string | null;
  Estado?: string;
  NroTransferencia?: number | null;
  esTransaccionCompleta?: boolean;
  // Usamos 'unknown' en lugar de 'any' para cualquier propiedad futura desconocida
  [key: string]: unknown; 
}

export const NotificationBell = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();

  const user = useAppSelector(selectCurrentUser);
  const token = localStorage.getItem('token'); 

  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationPayload[]>([]);
  
  const connectionRef = useRef<signalR.HubConnection | null>(null);

  const unreadCount = notifications.filter(n => n.Leido === "0" || n.Leido === 0).length;

  useEffect(() => {
    if (!user || !token) return;

    const connectSignalR = async () => {
      const connection = new signalR.HubConnectionBuilder()
        .withUrl(`${api.defaults.baseURL?.replace('/api', '')}/hubs/notificaciones`, {
          accessTokenFactory: () => token
        })
        .withAutomaticReconnect()
        .build();

      connectionRef.current = connection;

      connection.on("NuevaNotificacion", async (data: NotificationPayload) => {
        if (data.UbicacionDestino === user.ubicacion) {
          setNotifications(prev => [data, ...prev]);

          try {
            await connection.invoke("ConfirmarRecepcion", Number(data.Id));
          } catch (error) {
            console.error(`Error confirmando recepción de notif. ${data.Id}`, error);
          }
        }
      });

      try {
        await connection.start();
        console.log("Conexión a SignalR establecida.");
      } catch (error) {
        console.error("Error al conectar con SignalR:", error);
      }
    };

    connectSignalR();

    return () => {
      if (connectionRef.current) {
        connectionRef.current.stop();
      }
    };
  }, [user, token]);

  useEffect(() => {
    const fetchNotifications = async () => {
      if (!user) return;
      try {
        // Descomentar y ajustar la ruta de tu API para cargar el historial
        const response = await api.get(`/notificaciones/usuario/${user.ubicacion}`);
        setNotifications(response.data);
      } catch (error) {
        console.error('Error al cargar historial de notificaciones', error);
      }
    };
    fetchNotifications();
  }, [user]);

  const toggleDrawer = (newOpen: boolean) => () => {
    setOpen(newOpen);
  };

  const handleNotificationClick = async (notif: NotificationPayload) => {
    setNotifications(prev => prev.map(n => n.Id === notif.Id ? { ...n, Leido: "1" } : n));
    setOpen(false);

    try {
      // El parseo ahora utiliza nuestra interfaz estricta
      const payloadData = JSON.parse(notif.PayloadJson) as ParsedPayload;
      
      if (payloadData.Tipo === 'TRF') {
        navigate(`/tech/transfers/${payloadData.Id}/items`);
      } else {
        console.warn(`Tipo de navegación no configurada para: ${payloadData.Tipo}`);
      }

    } catch (e) {
      console.error("Error al parsear el PayloadJson de la notificación", e);
    }

    try {
      await api.patch(`/notificaciones/${notif.Id}/leer`);
    } catch (error) {
      console.error('Error al marcar en BD como leída', error);
    }
  };

  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, Leido: "1" })));
    try {
      await api.patch('/notificaciones/read-all'); 
    } catch (error) {
      console.error('Error al marcar todas como leídas', error);
    }
  };

  const formatDateTime = (isoString: string) => {
    if (!isoString || isoString === "NULL") return '';
    const date = new Date(isoString);
    return date.toLocaleString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getIconByType = (tipo: string) => {
    switch (tipo) {
      case 'TRANSFERENCIA': return <SwapHorizIcon />;
      default: return <InfoIcon />;
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
            notifications.map((notif) => {
              const isRead = notif.Leido === "1" || notif.Leido === 1;

              return (
                <React.Fragment key={notif.Id}>
                  <ListItem disablePadding sx={{ backgroundColor: isRead ? 'transparent' : '#f0f8ff' }}>
                    <ListItemButton alignItems="flex-start" onClick={() => handleNotificationClick(notif)} sx={{ p: 2 }}>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: isRead ? 'grey.400' : 'primary.main' }}>
                          {getIconByType(notif.Tipo)}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                            <Typography variant="subtitle2" fontWeight={isRead ? 'normal' : 'bold'} sx={{ pr: 2 }}>{notif.Titulo}</Typography>
                            {!isRead && <Box sx={{ width: 8, height: 8, bgcolor: 'error.main', borderRadius: '50%', mt: 0.5, flexShrink: 0 }} />}
                          </Box>
                        }
                        secondary={
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 1 }}>
                            <Typography variant="body2" color="text.primary">{notif.Mensaje}</Typography>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5 }}>
                              <Typography variant="caption" color="text.secondary">{formatDateTime(notif.FechaProceso || notif.UsuFechaCrea)}</Typography>
                              <Chip size="small" label={notif.Tipo} variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                            </Box>
                          </Box>
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                  <Divider component="li" />
                </React.Fragment>
              );
            })
          )}
        </List>
      </Drawer>
    </>
  );
};