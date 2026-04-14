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
import BuildIcon from '@mui/icons-material/Build'; 
import CheckCircleIcon from '@mui/icons-material/CheckCircle'; 
import AssignmentIcon from '@mui/icons-material/Assignment'; 

import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import * as signalR from '@microsoft/signalr';
import api from '../../services/api'; 
import { useAppSelector, useAppDispatch } from '../../app/hooks';
import { selectCurrentUser } from '../../features/auth/authSlice';

import { 
  fetchNotifications, markNotificationRead, markAllNotificationsRead, 
  addRealTimeNotification, selectAllNotifications, selectUnreadNotificationsCount,
  normalizeNotification, type NotificationPayload
} from '../../features/notifications/notificationsSlice';

export const NotificationBell = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const user = useAppSelector(selectCurrentUser);
  const token = localStorage.getItem('token'); 

  const [open, setOpen] = useState(false);
  const connectionRef = useRef<signalR.HubConnection | null>(null);

  const notifications = useAppSelector(selectAllNotifications);
  const unreadCount = useAppSelector(selectUnreadNotificationsCount);

  // 1. Obtener Historial Inicial
  useEffect(() => {
    if (user?.ubicacion) {
      dispatch(fetchNotifications(user.ubicacion));
    }
  }, [dispatch, user?.ubicacion]);

  // 2. Conexión SignalR
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

      connection.on("NuevaNotificacion", async (payload: unknown) => {
        const rawData = typeof payload === 'string' ? JSON.parse(payload) : payload;
        const data = normalizeNotification(rawData);
        
        if (!data.UbicacionDestino || data.UbicacionDestino === user.ubicacion) {
          dispatch(addRealTimeNotification(data));
          toast.info(`Nueva notificación: ${data.Titulo}`);

          try {
            await connection.invoke("ConfirmarRecepcion", data.Id);
          } catch (error) {
            console.error(`Error confirmando recepción de notif. ${data.Id}`, error);
          }
        }
      });

      try {
        await connection.start();
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
  }, [user, token, dispatch]);

  const toggleDrawer = (newOpen: boolean) => () => {
    setOpen(newOpen);
  };

  // 🚨 FIX MAESTRO: Extractor de Payload ultra-robusto
  const getPayloadData = (payloadData: unknown): Record<string, unknown> | null => {
    if (!payloadData) return null;
    
    if (typeof payloadData === 'object') return payloadData as Record<string, unknown>;
    
    if (typeof payloadData === 'string') {
      try {
        // En SignalR a veces viene doblemente stringificado o con saltos de línea
        const cleanedString = payloadData.replace(/\\n/g, '').replace(/\\"/g, '"');
        
        // Si el string empieza con comillas y adentro hay llaves, quitamos las comillas
        if (cleanedString.startsWith('"') && cleanedString.endsWith('"')) {
            return JSON.parse(cleanedString.slice(1, -1));
        }

        return JSON.parse(cleanedString);
      } catch (e) {
        console.error("Error parseando PayloadJson", e);
        return null;
      }
    }
    return null;
  };

  // 3. Redirección Inteligente
  const handleNotificationClick = async (notif: NotificationPayload) => {
    if (notif.Leido === "0") {
      dispatch(markNotificationRead(notif.Id));
    }
    
    setOpen(false);

    const payload = getPayloadData(notif.PayloadJson);

    if (!payload) {
      toast.error("No se pudo obtener la información de la notificación para redirigir.");
      return;
    }

    // Normalizamos el tipo a mayúsculas para evitar fallos de tipeo
    const tipoNotificacion = (notif.Tipo || '').toUpperCase();

    // 🚨 ENRUTADOR PERMISIVO
    switch (tipoNotificacion) {
      case 'AUTORIZACION_SERVICIO_TECNICO':
      case 'LLAMADA_SERVICIO_AUTORIZADA': {
        // Buscamos el ID en múltiples variaciones
        const osId = payload.llamadaServicioId || payload.LlamadaServicioId || payload.nroServicio || payload.NroServicio;
        if (osId) {
          navigate(`/tech/llamadas/${osId}/edit`);
        } else {
          toast.error("El formato de la notificación no incluye el número de la Orden.");
        }
        break;
      }

      case 'SOL_TRASLADO_SAP': {
        const solId = payload.solicitudTransferenciaId || payload.SolicitudTransferenciaId || payload.id || payload.Id;
        if (solId) {
          navigate(`/tech/transfers/new?solicitudId=${solId}`);
        } else {
          toast.error("El formato de la notificación no incluye el número de la Solicitud.");
        }
        break;
      }

      case 'TRANSFERENCIA':
      case 'TRF': {
        const trfId = payload.Id ?? payload.id ?? payload.ID;
        if (trfId) {
          navigate(`/tech/transfers/${trfId}/items`);
        } else {
          toast.error("El formato de la notificación no incluye el número de la Transferencia.");
        }
        break;
      }

      default: {
        console.warn(`Tipo de navegación no configurada: ${tipoNotificacion}`);
        toast.info("No hay acción configurada para este tipo de notificación.");
        break;
      }
    }
  };

  const markAllAsRead = () => {
    dispatch(markAllNotificationsRead());
  };

  const formatDateTime = (isoString: string) => {
    if (!isoString || isoString === "NULL") return '';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getIconByType = (tipo: string) => {
    const t = (tipo || '').toUpperCase();
    switch (t) {
      case 'TRANSFERENCIA': 
      case 'TRF': 
        return <SwapHorizIcon />;
      case 'AUTORIZACION_SERVICIO_TECNICO': 
        return <BuildIcon />;
      case 'LLAMADA_SERVICIO_AUTORIZADA': 
        return <CheckCircleIcon />;
      case 'SOL_TRASLADO_SAP': 
        return <AssignmentIcon />;
      default: 
        return <InfoIcon />;
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