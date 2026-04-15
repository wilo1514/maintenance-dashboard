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
  type NotificationPayload
} from '../../features/notifications/notificationsSlice';

interface RawNotification {
  Id?: number | string;
  id?: number | string;
  Tipo?: string;
  tipo?: string;
  Titulo?: string;
  titulo?: string;
  Mensaje?: string;
  mensaje?: string;
  FechaProceso?: string;
  fechaProceso?: string;
  UsuFechaCrea?: string;
  usuFechaCrea?: string;
  Leido?: string | boolean | number;
  leido?: string | boolean | number;
  PayloadJson?: string | Record<string, unknown>;
  payloadJson?: string | Record<string, unknown>;
}

const getLocalISOString = () => {
  const date = new Date();
  const tzoffset = date.getTimezoneOffset() * 60000; 
  return new Date(date.getTime() - tzoffset).toISOString().slice(0, -1); 
};

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

  // 🚨 REF CLAVE: Permite leer las notificaciones dentro de SignalR sin causar reconexiones
  const notificationsRef = useRef(notifications);
  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  // 1. Obtener Historial Inicial
  useEffect(() => {
    if (user?.ubicacion) {
      dispatch(fetchNotifications(user.ubicacion));
    }
  }, [dispatch, user?.ubicacion]);

  // 2. Conexión SignalR (Inyección Directa y Segura)
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
        try {
          let rawData: Record<string, unknown> = {};
          
          if (typeof payload === 'string') {
            rawData = JSON.parse(payload) as Record<string, unknown>;
          } else if (typeof payload === 'object' && payload !== null) {
            rawData = payload as Record<string, unknown>;
          }

          // Filtros Anti-Fantasmas
          const idVal = rawData.Id || rawData.id;
          const tipoVal = rawData.Tipo || rawData.tipo;
          if (!idVal || !tipoVal) return;

          const destino = String(rawData.UbicacionDestino || rawData.ubicacionDestino || '');
          if (destino && destino !== user.ubicacion) return;

          // Filtro Anti-Duplicados (Usa la Ref para ver el estado actual al instante)
          const yaExiste = notificationsRef.current.some(n => String(n.Id) === String(idVal));
          if (yaExiste) return;

          // 🚨 PREPARAMOS LA NOTIFICACIÓN PARA REDUX
          const rawPayloadJson = rawData.PayloadJson || rawData.payloadJson;
          const payloadJsonSeguro = typeof rawPayloadJson === 'string'
            ? rawPayloadJson
            : JSON.stringify(rawPayloadJson || {});

          // Esparcimos el rawData original para no perder BodegaDestino, Intentos, Estado, etc.
          const notificacionNormalizada = {
            ...rawData,
            Id: Number(idVal),
            Tipo: String(tipoVal),
            Titulo: String(rawData.Titulo || rawData.titulo || "Nueva Notificación"),
            Mensaje: String(rawData.Mensaje || rawData.mensaje || ""),
            FechaProceso: String(rawData.FechaProceso || rawData.fechaProceso || rawData.UsuFechaCrea || rawData.usuFechaCrea || getLocalISOString()),
            UsuFechaCrea: String(rawData.UsuFechaCrea || rawData.usuFechaCrea || getLocalISOString()),
            Leido: "0",
            PayloadJson: payloadJsonSeguro,
            UbicacionDestino: destino
          } as unknown as NotificationPayload;

          // Inyectamos a Redux: ¡El numerito de la campana sube inmediatamente!
          dispatch(addRealTimeNotification(notificacionNormalizada));
          toast.info(notificacionNormalizada.Titulo);

          try {
            await connection.invoke("ConfirmarRecepcion", String(idVal));
          } catch (e) {
            console.error("Error confirmando recepción:", e);
          }

        } catch (error) {
          console.error("Error procesando payload SignalR:", error);
        }
      });

      try {
        await connection.start();
      } catch (error) {
        console.error("Error conectando a SignalR:", error);
      }
    };

    connectSignalR();

    return () => {
      if (connectionRef.current) {
        connectionRef.current.stop();
      }
    };
  }, [user, token, dispatch]); 

  const handleOpenDrawer = () => {
    // Sincronización silenciosa extra por si se perdió algún socket
    if (user?.ubicacion) {
      dispatch(fetchNotifications(user.ubicacion));
    }
    setOpen(true);
  };

  const handleCloseDrawer = () => {
    setOpen(false);
  };

  // Parsea el JSON estrictamente
  const getPayloadData = (payloadData: unknown): Record<string, unknown> | null => {
    if (!payloadData) return null;
    if (typeof payloadData === 'object') return payloadData as Record<string, unknown>;
    
    if (typeof payloadData === 'string') {
      try {
        let cleaned = payloadData.trim();
        if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
          cleaned = cleaned.slice(1, -1).replace(/\\"/g, '"');
        }
        return JSON.parse(cleaned) as Record<string, unknown>;
      } catch (error) {
        console.error("Error parseando PayloadJson:", error);
        return null;
      }
    }
    return null;
  };

  const extractIdFromPayload = (payload: Record<string, unknown>, possibleKeys: string[]): string | null => {
    for (const key of possibleKeys) {
      const foundKey = Object.keys(payload).find(k => k.toLowerCase() === key.toLowerCase());
      if (foundKey && payload[foundKey]) {
        return String(payload[foundKey]);
      }
    }
    return null;
  };

  // 🚨 EL DICCIONARIO DE RUTAS
  const routeDictionary: Record<string, (payload: Record<string, unknown>) => string | null> = {
    'AUTORIZACION_SERVICIO_TECNICO': (payload) => {
      const id = extractIdFromPayload(payload, ['llamadaservicioid', 'nroservicio', 'id']);
      return id ? `/tech/llamadas/${id}/edit` : null;
    },
    'LLAMADA_SERVICIO_AUTORIZADA': (payload) => {
      const id = extractIdFromPayload(payload, ['llamadaservicioid', 'nroservicio', 'id']);
      return id ? `/tech/llamadas/${id}/edit` : null;
    },
    'SOL_TRASLADO_SAP': (payload) => {
      const id = extractIdFromPayload(payload, ['solicitudtransferenciaid', 'id']);
      return id ? `/tech/transfers/new?solicitudId=${id}` : null;
    },
    'TRANSFERENCIA': (payload) => {
      const id = extractIdFromPayload(payload, ['transferenciaid', 'id']);
      return id ? `/tech/transfers/${id}/items` : null;
    },
    'TRF': (payload) => {
      const id = extractIdFromPayload(payload, ['transferenciaid', 'id']);
      return id ? `/tech/transfers/${id}/items` : null;
    }
  };

  // 3. Redirección Inteligente
  const handleNotificationClick = async (item: unknown) => {
    const notif = item as RawNotification;
    
    const nId = Number(notif.Id ?? notif.id);
    const nTipo = String(notif.Tipo ?? notif.tipo ?? '').toUpperCase();
    const nLeido = String(notif.Leido ?? notif.leido).toLowerCase();
    const nPayloadStr = notif.PayloadJson ?? notif.payloadJson;

    if (nLeido === "0" || nLeido === "false") {
      dispatch(markNotificationRead(nId));
    }
    
    setOpen(false);

    const payloadObj = getPayloadData(nPayloadStr);

    if (!payloadObj) {
      toast.error("No se pudo obtener la información de la notificación para redirigir.");
      return;
    }

    const routeFn = routeDictionary[nTipo];

    if (routeFn) {
      const targetRoute = routeFn(payloadObj);
      if (targetRoute) {
        navigate(targetRoute);
      } else {
        toast.error("La notificación no contiene el ID necesario para redirigir.");
      }
    } else {
      console.warn(`Tipo de navegación no configurada: ${nTipo}`);
      toast.info("No hay acción configurada para este tipo de notificación.");
    }
  };

  const formatDateTime = (isoString: string) => {
    if (!isoString || isoString === "NULL") return '';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getIconByType = (tipo: string) => {
    const t = String(tipo || '').toUpperCase();
    if (t.includes('TRANSFERENCIA') || t === 'TRF') return <SwapHorizIcon />;
    if (t.includes('AUTORIZACION') || t.includes('LLAMADA')) return <BuildIcon />;
    if (t.includes('SOL_TRASLADO')) return <AssignmentIcon />;
    return <InfoIcon />;
  };

  return (
    <>
      <IconButton color="inherit" onClick={handleOpenDrawer}>
        <Badge badgeContent={unreadCount} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>

      <Drawer anchor="right" open={open} onClose={handleCloseDrawer} PaperProps={{ sx: { width: isMobile ? '85%' : 400 } }}>
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'primary.main', color: 'white' }}>
          <Typography variant="h6" fontWeight="bold">Notificaciones</Typography>
          <IconButton color="inherit" onClick={handleCloseDrawer} size="small"><CloseIcon /></IconButton>
        </Box>

        {unreadCount > 0 && (
          <Box sx={{ px: 2, py: 1, display: 'flex', justifyContent: 'flex-end', borderBottom: '1px solid #eee' }}>
            <Button size="small" startIcon={<DoneAllIcon />} onClick={() => dispatch(markAllNotificationsRead())}>Marcar todo como leído</Button>
          </Box>
        )}

        <List sx={{ p: 0 }}>
          {notifications.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}><Typography color="text.secondary">No tienes notificaciones nuevas.</Typography></Box>
          ) : (
            notifications.map((item: unknown) => {
              const notif = item as RawNotification;
              
              const nId = Number(notif.Id ?? notif.id);
              const nTipo = String(notif.Tipo ?? notif.tipo ?? '');
              const nTitulo = String(notif.Titulo ?? notif.titulo ?? '');
              const nMensaje = String(notif.Mensaje ?? notif.mensaje ?? '');
              const nFecha = String(notif.FechaProceso ?? notif.fechaProceso ?? notif.UsuFechaCrea ?? notif.usuFechaCrea ?? '');
              const nLeido = String(notif.Leido ?? notif.leido).toLowerCase();
              
              const isRead = nLeido === "1" || nLeido === "true";

              return (
                <React.Fragment key={nId}>
                  <ListItem disablePadding sx={{ backgroundColor: isRead ? 'transparent' : '#f0f8ff' }}>
                    <ListItemButton alignItems="flex-start" onClick={() => handleNotificationClick(notif)} sx={{ p: 2 }}>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: isRead ? 'grey.400' : 'primary.main' }}>
                          {getIconByType(nTipo)}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                            <Typography variant="subtitle2" fontWeight={isRead ? 'normal' : 'bold'} sx={{ pr: 2 }}>{nTitulo}</Typography>
                            {!isRead && <Box sx={{ width: 8, height: 8, bgcolor: 'error.main', borderRadius: '50%', mt: 0.5, flexShrink: 0 }} />}
                          </Box>
                        }
                        secondary={
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 1 }}>
                            <Typography variant="body2" color="text.primary">{nMensaje}</Typography>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5 }}>
                              <Typography variant="caption" color="text.secondary">{formatDateTime(nFecha)}</Typography>
                              <Chip size="small" label={nTipo} variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
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