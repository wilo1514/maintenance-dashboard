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
import BuildIcon from '@mui/icons-material/Build'; // Icono para OS Requerida
import CheckCircleIcon from '@mui/icons-material/CheckCircle'; // Icono para OS Autorizada
import AssignmentIcon from '@mui/icons-material/Assignment'; // Icono para Solicitudes

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
        console.log(" SIGNALR RECIBIÓ UN MENSAJE:", payload);

        const rawData = typeof payload === 'string' ? JSON.parse(payload) : payload;
        const data = normalizeNotification(rawData);
        
        console.log(" Validando Destino | Notificación pide:", data.UbicacionDestino, "| Mi Usuario es:", user.ubicacion);

        if (!data.UbicacionDestino || data.UbicacionDestino === user.ubicacion) {
          console.log(" VALIDACIÓN PASADA: Inyectando a Redux...");
          
          dispatch(addRealTimeNotification(data));
          toast.info(`Nueva notificación: ${data.Titulo}`);

          try {
            await connection.invoke("ConfirmarRecepcion", data.Id);
          } catch (error) {
            console.error(`Error confirmando recepción de notif. ${data.Id}`, error);
          }
        } else {
          console.warn("Notificación ignorada porque no pertenece a esta ubicación.");
        }
      });

      try {
        await connection.start();
        console.log(" Conexión a SignalR establecida con éxito.");
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

  // 🚨 FIX: Reemplazado 'any' por 'unknown' y parseo seguro
  const getPayloadData = (payloadData: unknown): Record<string, unknown> | null => {
    if (!payloadData) return null;
    
    if (typeof payloadData === 'object') return payloadData as Record<string, unknown>;
    
    if (typeof payloadData === 'string') {
      try {
        return JSON.parse(payloadData);
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
      toast.error("No se pudo obtener la información para redirigir.");
      return;
    }

    // 🚨 FIX: Envolver los cases en { } resuelve el "Unexpected lexical declaration"
    switch (notif.Tipo) {
      case 'AUTORIZACION_SERVICIO_TECNICO':
      case 'LLAMADA_SERVICIO_AUTORIZADA': {
        const osId = payload.llamadaServicioId || payload.LlamadaServicioId;
        if (osId) {
          navigate(`/tech/llamadas/${osId}/edit`);
        } else {
          toast.error("Falta el ID de la Orden de Servicio en la notificación.");
        }
        break;
      }

      case 'SOL_TRASLADO_SAP': {
        const solId = payload.solicitudTransferenciaId || payload.SolicitudTransferenciaId;
        if (solId) {
          navigate(`/tech/transfers/new?solicitudId=${solId}`);
        } else {
          toast.error("Falta el ID de la Solicitud en la notificación.");
        }
        break;
      }

      case 'TRANSFERENCIA':
      case 'TRF': {
        const trfId = payload.Id ?? payload.id ?? payload.ID;
        if (trfId) {
          navigate(`/tech/transfers/${trfId}/items`);
        } else {
          toast.error("Falta el ID de la Transferencia en la notificación.");
        }
        break;
      }

      default: {
        console.warn(`Tipo de navegación no configurada: ${notif.Tipo}`);
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
    switch (tipo) {
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