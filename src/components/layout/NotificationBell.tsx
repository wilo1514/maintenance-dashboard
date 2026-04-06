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

// Interfaz para usar en todo nuestro frontend (Con mayúsculas)
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
  Leido: string; 
  Intentos: string;
  FechaEvento: string;
  FechaProceso: string;
  FechaLectura: string;
  FechaUltimoIntento: string;
  ErrorMensaje: string;
  UsuCrea: string;
  UsuFechaCrea: string;
}

export interface ParsedPayload {
  Id: number;
  Tipo: string;
  [key: string]: unknown; 
}

// 🛠️ EL NORMALIZADOR: Convierte todo a un formato único sin importar si viene de SignalR o del GET
const normalizeNotification = (raw: Record<string, unknown>): NotificationPayload => {
  return {
    Id: Number(raw.Id ?? raw.id ?? 0),
    Tipo: String(raw.Tipo ?? raw.tipo ?? ''),
    Titulo: String(raw.Titulo ?? raw.titulo ?? 'Notificación'),
    Mensaje: String(raw.Mensaje ?? raw.mensaje ?? ''),
    UbicacionDestino: String(raw.UbicacionDestino ?? raw.ubicacionDestino ?? ''),
    BodegaDestino: String(raw.BodegaDestino ?? raw.bodegaDestino ?? ''),
    Referencia: String(raw.Referencia ?? raw.referencia ?? ''),
    PayloadJson: String(raw.PayloadJson ?? raw.payloadJson ?? '{}'),
    Estado: String(raw.Estado ?? raw.estado ?? ''),
    Leido: String(raw.Leido ?? raw.leido ?? '0'), // Estandarizamos a string "0" o "1"
    Intentos: String(raw.Intentos ?? raw.intentos ?? '0'),
    FechaEvento: String(raw.FechaEvento ?? raw.fechaEvento ?? ''),
    FechaProceso: String(raw.FechaProceso ?? raw.fechaProceso ?? ''),
    FechaLectura: String(raw.FechaLectura ?? raw.fechaLectura ?? ''),
    FechaUltimoIntento: String(raw.FechaUltimoIntento ?? raw.fechaUltimoIntento ?? ''),
    ErrorMensaje: String(raw.ErrorMensaje ?? raw.errorMensaje ?? ''),
    UsuCrea: String(raw.UsuCrea ?? raw.usuCrea ?? ''),
    UsuFechaCrea: String(raw.UsuFechaCrea ?? raw.usuFechaCrea ?? '')
  };
};

export const NotificationBell = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();

  const user = useAppSelector(selectCurrentUser);
  const token = localStorage.getItem('token'); 

  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationPayload[]>([]);
  
  const connectionRef = useRef<signalR.HubConnection | null>(null);

  // Como ya estandarizamos Leido a string, contamos fácilmente las que digan "0"
  const unreadCount = notifications.filter(n => n.Leido === "0").length;

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

      connection.on("NuevaNotificacion", async (rawData: Record<string, unknown>) => {
        // Normalizamos la data que llega por SignalR
        const data = normalizeNotification(rawData);

        if (data.UbicacionDestino === user.ubicacion) {
          setNotifications(prev => [data, ...prev]);

          try {
            await connection.invoke("ConfirmarRecepcion", data.Id);
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
        // Obtenemos todo el historial (AQUÍ ESTÁ LA SOLUCIÓN PARA LAS DESCONECTADAS)
        const response = await api.get<Record<string, unknown>[]>('/notificaciones');
        
        // 1. Normalizamos todas las notificaciones
        const normalizedData = response.data.map(normalizeNotification);

        // 2. Filtramos para el usuario actual
        const misNotificaciones = normalizedData.filter(notif => notif.UbicacionDestino === user.ubicacion);

        // 3. ¡Las guardamos! Ahora sí verás el número rojo al iniciar sesión
        setNotifications(misNotificaciones);

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
    // 1. Apaga el estado de no leído en la UI instantáneamente
    setNotifications(prev => prev.map(n => n.Id === notif.Id ? { ...n, Leido: "1" } : n));
    setOpen(false);

    // 2. Redirección Inteligente
    try {
      const payloadData = JSON.parse(notif.PayloadJson) as ParsedPayload;
      if (payloadData.Tipo === 'TRF') {
        navigate(`/tech/transfers/${payloadData.Id}/items`);
      } else {
        console.warn(`Tipo de navegación no configurada para: ${payloadData.Tipo}`);
      }
    } catch (e) {
      console.error("Error al parsear el PayloadJson de la notificación", e);
    }

    // 3. Endpoint exacto para el Backend: PATCH /notificaciones/{id}/leer
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
    if (isNaN(date.getTime())) return '';
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
              const isRead = notif.Leido === "1";

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