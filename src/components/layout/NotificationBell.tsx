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
  selectAllNotifications, selectUnreadNotificationsCount
} from '../../features/notifications/notificationsSlice';

// Interfaz estricta para leer datos independientemente de si vienen de SignalR o de SQL
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

  // 2. Conexión SignalR (Solo como Timbre)
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

      // Usamos unknown en lugar de any
      connection.on("NuevaNotificacion", async (payload: unknown) => {
        let tituloToast = "¡Tienes una nueva notificación!";
        
        try {
          const rawData = typeof payload === 'string' ? JSON.parse(payload) as Record<string, unknown> : (payload as Record<string, unknown>);
          if (rawData && (rawData.Titulo || rawData.titulo)) {
            tituloToast = String(rawData.Titulo || rawData.titulo);
          }
        } catch (error) {
          // Se usa la variable error para el linter
          console.error("No se pudo extraer el título del payload de SignalR:", error);
        }

        toast.info(tituloToast);

        // Refresco silencioso con SQL para asegurar integridad
        if (user?.ubicacion) {
          dispatch(fetchNotifications(user.ubicacion));
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

  const handleOpenDrawer = () => {
    if (user?.ubicacion) {
      dispatch(fetchNotifications(user.ubicacion));
    }
    setOpen(true);
  };

  const handleCloseDrawer = () => {
    setOpen(false);
  };

  // Parsea el JSON estrictamente a Record<string, unknown>
  const getPayloadData = (payloadData: unknown): Record<string, unknown> | null => {
    if (!payloadData) return null;
    if (typeof payloadData === 'object') return payloadData as Record<string, unknown>;
    
    if (typeof payloadData === 'string') {
      try {
        const cleanedString = payloadData.replace(/\\n/g, '').replace(/\\"/g, '"');
        if (cleanedString.startsWith('"') && cleanedString.endsWith('"')) {
            return JSON.parse(cleanedString.slice(1, -1)) as Record<string, unknown>;
        }
        return JSON.parse(cleanedString) as Record<string, unknown>;
      } catch (error) {
        console.error("Error parseando PayloadJson:", error);
        return null;
      }
    }
    return null;
  };

  // 3. Redirección Inteligente
  const handleNotificationClick = async (item: unknown) => {
    const notif = item as RawNotification;
    
    const nId = Number(notif.Id ?? notif.id);
    const nTipo = String(notif.Tipo ?? notif.tipo ?? '').toUpperCase();
    const nLeido = String(notif.Leido ?? notif.leido);
    const nPayloadStr = notif.PayloadJson ?? notif.payloadJson;

    if (nLeido === "0" || nLeido === "false") {
      dispatch(markNotificationRead(nId));
    }
    
    setOpen(false);

    const payload = getPayloadData(nPayloadStr);

    if (!payload) {
      toast.error("No se pudo obtener la información de la notificación para redirigir.");
      return;
    }

    switch (nTipo) {
      case 'AUTORIZACION_SERVICIO_TECNICO':
      case 'LLAMADA_SERVICIO_AUTORIZADA': {
        const osId = payload['llamadaServicioId'] || payload['LlamadaServicioId'] || payload['nroServicio'] || payload['NroServicio'];
        if (osId) {
          navigate(`/tech/llamadas/${String(osId)}/edit`);
        } else {
          toast.error("El formato de la notificación no incluye el número de la Orden.");
        }
        break;
      }

      case 'SOL_TRASLADO_SAP': {
        const solId = payload['solicitudTransferenciaId'] || payload['SolicitudTransferenciaId'] || payload['id'] || payload['Id'];
        if (solId) {
          navigate(`/tech/transfers/new?solicitudId=${String(solId)}`);
        } else {
          toast.error("El formato de la notificación no incluye el número de la Solicitud.");
        }
        break;
      }

      case 'TRANSFERENCIA':
      case 'TRF': {
        const trfId = payload['Id'] ?? payload['id'] ?? payload['ID'];
        if (trfId) {
          navigate(`/tech/transfers/${String(trfId)}/items`);
        } else {
          toast.error("El formato de la notificación no incluye el número de la Transferencia.");
        }
        break;
      }

      default: {
        console.warn(`Tipo de navegación no configurada: ${nTipo}`);
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
            <Button size="small" startIcon={<DoneAllIcon />} onClick={markAllAsRead}>Marcar todo como leído</Button>
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
              const nLeido = String(notif.Leido ?? notif.leido);
              
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