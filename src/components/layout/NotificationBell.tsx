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

  // 2. Conexión SignalR (INTACTA)
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
        const data = normalizeNotification(rawData) as NotificationPayload;
        
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

  // 🚨 EL CAMBIO SOLICITADO: Lanzar GET al abrir la campanita
  const toggleDrawer = (newOpen: boolean) => () => {
    if (newOpen && user?.ubicacion) {
      // Al abrir, traemos la lista fresca de la base de datos
      dispatch(fetchNotifications(user.ubicacion));
    }
    setOpen(newOpen);
  };

  // Función para buscar llaves en el JSON ignorando Mayúsculas/Minúsculas
  const getPayloadValue = (payloadObj: Record<string, unknown>, possibleKeys: string[]): string | null => {
    const lowerKeys = possibleKeys.map(k => k.toLowerCase());
    const foundKey = Object.keys(payloadObj).find(k => lowerKeys.includes(k.toLowerCase()));
    return foundKey ? String(payloadObj[foundKey]) : null;
  };

  // 3. Redirección Inteligente y Diccionario de Rutas
  const handleNotificationClick = async (notif: NotificationPayload) => {
    const nId = Number(notif.Id);
    const nTipo = String(notif.Tipo || '').toUpperCase();
    
    // 🚨 CORRECCIÓN DEL ERROR DE TYPESCRIPT (string vs boolean)
    const leidoStr = String(notif.Leido).toLowerCase();
    if (leidoStr === "0" || leidoStr === "false") {
      dispatch(markNotificationRead(nId));
    }
    
    setOpen(false);

    // Parseo seguro del PayloadJson
    let payload: Record<string, unknown> | null = null;
    try {
      if (typeof notif.PayloadJson === 'object' && notif.PayloadJson !== null) {
        payload = notif.PayloadJson as Record<string, unknown>;
      } else if (typeof notif.PayloadJson === 'string') {
        let cleanStr = notif.PayloadJson.replace(/\\n/g, '').replace(/\\"/g, '"');
        if (cleanStr.startsWith('"') && cleanStr.endsWith('"')) {
          cleanStr = cleanStr.slice(1, -1);
        }
        payload = JSON.parse(cleanStr) as Record<string, unknown>;
      }
    } catch (error) {
      console.error("Error parseando PayloadJson", error);
    }

    if (!payload) {
      toast.error("No se pudo obtener la información de la notificación para redirigir.");
      return;
    }

    // Extraemos los IDs posibles
    const osId = getPayloadValue(payload, ['llamadaservicioid', 'nroservicio', 'id']);
    const solId = getPayloadValue(payload, ['solicitudtransferenciaid', 'id']);
    const trfId = getPayloadValue(payload, ['id', 'transferenciaid']);

    // DICCIONARIO DE RUTAS SENCILLO
    const routesDictionary: Record<string, string | null> = {
      'AUTORIZACION_SERVICIO_TECNICO': osId ? `/tech/llamadas/${osId}/edit` : null,
      'LLAMADA_SERVICIO_AUTORIZADA': osId ? `/tech/llamadas/${osId}/edit` : null,
      'SOL_TRASLADO_SAP': solId ? `/tech/transfers/new?solicitudId=${solId}` : null,
      'TRANSFERENCIA': trfId ? `/tech/transfers/${trfId}/items` : null,
      'TRF': trfId ? `/tech/transfers/${trfId}/items` : null
    };

    const targetRoute = routesDictionary[nTipo];

    if (targetRoute) {
      navigate(targetRoute);
    } else {
      console.warn(`Ruta no resuelta para el tipo: ${nTipo}`, payload);
      toast.warning("La notificación no contiene los datos necesarios (ID) para abrirla.");
    }
  };

  const markAllAsRead = () => {
    dispatch(markAllNotificationsRead());
  };

  const formatDateTime = (isoString: string | undefined) => {
    if (!isoString || isoString === "NULL") return '';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getIconByType = (tipo: string | undefined) => {
    const t = String(tipo || '').toUpperCase();
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
              const isRead = String(notif.Leido) === "1" || String(notif.Leido) === "true";

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