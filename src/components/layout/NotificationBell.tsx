import React, { useState, useEffect, useRef } from 'react';
import { 
  Badge, IconButton, Drawer, Box, Typography, List, ListItem, 
  ListItemButton, ListItemAvatar, Avatar, ListItemText, Divider, Chip,
  useMediaQuery, useTheme, Button, Tabs, Tab
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'; 
import InfoIcon from '@mui/icons-material/Info'; 
import CloseIcon from '@mui/icons-material/Close';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import BuildIcon from '@mui/icons-material/Build'; 
import CheckCircleIcon from '@mui/icons-material/CheckCircle'; 
import AssignmentIcon from '@mui/icons-material/Assignment'; 
import ArticleIcon from '@mui/icons-material/Article'; 

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

  const [currentTab, setCurrentTab] = useState(0);

  const notifications = useAppSelector(selectAllNotifications);
  const unreadCount = useAppSelector(selectUnreadNotificationsCount);

  // 1. Obtener Historial Inicial
  useEffect(() => {
    if (user?.ubicacion) {
      dispatch(fetchNotifications(user.ubicacion));
    }
  }, [dispatch, user?.ubicacion]);

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

  const toggleDrawer = (newOpen: boolean) => () => {
    if (newOpen && user?.ubicacion) {
      dispatch(fetchNotifications(user.ubicacion));
    }
    setOpen(newOpen);
  };

  const getPayloadValue = (payloadObj: Record<string, unknown>, possibleKeys: string[]): string | null => {
    const lowerKeys = possibleKeys.map(k => k.toLowerCase());
    const foundKey = Object.keys(payloadObj).find(k => lowerKeys.includes(k.toLowerCase()));
    return foundKey ? String(payloadObj[foundKey]) : null;
  };

  const handleNotificationClick = async (notif: NotificationPayload) => {
    const nId = Number(notif.Id);
    const nTipo = String(notif.Tipo || '').toUpperCase();
    
    const leidoStr = String(notif.Leido).toLowerCase();
    if (leidoStr === "0" || leidoStr === "false") {
      dispatch(markNotificationRead(nId));
    }
    
    setOpen(false);

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

    const osId = getPayloadValue(payload, ['llamadaservicioid', 'nroservicio', 'id']);
    const solId = getPayloadValue(payload, ['solicitudtransferenciaid', 'id']);
    const trfId = getPayloadValue(payload, ['id', 'transferenciaid']);
    const ocId = getPayloadValue(payload, ['ordencompraid']); 

    const routesDictionary: Record<string, string | null> = {
      'AUTORIZACION_SERVICIO_TECNICO': osId ? `/tech/llamadas/${osId}/edit` : null,
      'LLAMADA_SERVICIO_AUTORIZADA': osId ? `/tech/llamadas/${osId}/edit` : null,
      'SOL_TRASLADO_SAP': solId ? `/tech/transfers/new?solicitudId=${solId}` : null,
      'TRANSFERENCIA': trfId ? `/tech/transfers/${trfId}/items` : null,
      'TRF': trfId ? `/tech/transfers/${trfId}/items` : null,
      'AUTORIZACION_ORDEN_COMPRA': ocId ? `/tech/ordenes-compra/${ocId}/edit` : null 
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
      case 'AUTORIZACION_ORDEN_COMPRA': 
        return <ArticleIcon />;
      default: 
        return <InfoIcon />;
    }
  };

  const getCategoryIndex = (tipo: string | undefined) => {
    const t = String(tipo || '').toUpperCase();
    if (t.includes('LLAMADA') || t.includes('SERVICIO_TECNICO')) return 1;
    if (t.includes('TRANSFERENCIA') || t === 'TRF' || t.includes('TRASLADO')) return 2; // Inventario
    if (t.includes('ORDEN_COMPRA')) return 3; // Compras
    return 4; // Otros
  };

  const sortedNotifications = [...notifications].sort((a, b) => Number(b.Id) - Number(a.Id));

  const filteredNotifications = sortedNotifications.filter(notif => {
    if (currentTab === 0) return true;
    return getCategoryIndex(notif.Tipo) === currentTab;
  });

  const getUnreadCountByCategory = (categoryIndex: number) => {
    return sortedNotifications.filter(n => {
      const isUnread = String(n.Leido) === "0" || String(n.Leido) === "false";
      if (categoryIndex === 0) return isUnread;
      return isUnread && getCategoryIndex(n.Tipo) === categoryIndex;
    }).length;
  };

  const renderTabLabel = (text: string, count: number) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {text}
      {count > 0 && <Chip size="small" label={count} color="error" sx={{ height: 18, minWidth: 18, fontSize: '0.7rem' }} />}
    </Box>
  );

  return (
    <>
      <IconButton color="inherit" onClick={toggleDrawer(true)}>
        <Badge badgeContent={unreadCount} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>

      <Drawer anchor="right" open={open} onClose={toggleDrawer(false)} PaperProps={{ sx: { width: isMobile ? '90%' : 450 } }}>
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'primary.main', color: 'white' }}>
          <Typography variant="h6" fontWeight="bold">Notificaciones</Typography>
          <IconButton color="inherit" onClick={toggleDrawer(false)} size="small"><CloseIcon /></IconButton>
        </Box>

        <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Tabs 
            value={currentTab} 
            onChange={(_, newValue) => setCurrentTab(newValue)} 
            variant="scrollable" 
            scrollButtons="auto"
            allowScrollButtonsMobile
          >
            <Tab label={renderTabLabel('Todas', getUnreadCountByCategory(0))} />
            <Tab label={renderTabLabel('Serv. Técnico', getUnreadCountByCategory(1))} />
            <Tab label={renderTabLabel('Inventario', getUnreadCountByCategory(2))} />
            <Tab label={renderTabLabel('Compras', getUnreadCountByCategory(3))} />
            <Tab label={renderTabLabel('Otros', getUnreadCountByCategory(4))} />
          </Tabs>
        </Box>

        <Box sx={{ px: 2, py: 1, display: 'flex', justifyContent: 'flex-end', borderBottom: '1px solid #eee' }}>
          <Button size="small" startIcon={<DoneAllIcon />} onClick={markAllAsRead} disabled={unreadCount === 0}>
            Marcar todas como leídas
          </Button>
        </Box>

        <List sx={{ p: 0, overflowY: 'auto' }}>
          {filteredNotifications.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}><Typography color="text.secondary">No tienes notificaciones en esta categoría.</Typography></Box>
          ) : (
            filteredNotifications.map((notif) => {
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
                              <Chip size="small" label={notif.Tipo} variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
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
