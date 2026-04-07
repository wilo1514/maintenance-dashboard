import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import { type RootState } from '../../app/store';
import api from '../../services/api';
import { TECH_ENDPOINTS } from '../../services/endpoints/tech';

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

// Exportamos el normalizador para usarlo también en el componente con SignalR
export const normalizeNotification = (raw: Record<string, unknown>): NotificationPayload => {
  const rawLeido = raw.Leido ?? raw.leido;
  const isRead = rawLeido === true || rawLeido === 'true' || rawLeido === 1 || rawLeido === '1';

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
    Leido: isRead ? "1" : "0", 
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

interface NotificationsState {
  list: NotificationPayload[];
  isLoading: boolean;
  error: string | null;
}

const initialState: NotificationsState = {
  list: [],
  isLoading: false,
  error: null,
};

export const fetchNotifications = createAsyncThunk(
  'notifications/fetchNotifications',
  async (ubicacionUsuario: string, { rejectWithValue }) => {
    try {
      const response = await api.get<Record<string, unknown>[]>(TECH_ENDPOINTS.GET_NOTIFICATIONS);
      const normalizedData = response.data.map(normalizeNotification);
      return normalizedData.filter(notif => notif.UbicacionDestino === ubicacionUsuario);
    } catch (error) {
      if (axios.isAxiosError(error)) return rejectWithValue(error.response?.data?.message || 'Error al cargar notificaciones');
      return rejectWithValue('Error desconocido');
    }
  }
);

export const markNotificationRead = createAsyncThunk(
  'notifications/markRead',
  async (id: number, { rejectWithValue }) => {
    try {
      await api.patch(TECH_ENDPOINTS.MARK_NOTIFICATION_READ(id));
      return id;
    } catch (error) {
      return rejectWithValue('Error al marcar como leída'+ error);
    }
  }
);

export const markAllNotificationsRead = createAsyncThunk(
  'notifications/markAllRead',
  async (_, { rejectWithValue }) => {
    try {
      await api.patch(TECH_ENDPOINTS.MARK_ALL_NOTIFICATIONS_READ);
      return true;
    } catch (error) {
      return rejectWithValue('Error al marcar todas como leídas' + error);
    }
  }
);

export const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    // 🚨 ESTA ES LA FUNCIÓN QUE LOGRA EL EFECTO WHATSAPP 🚨
    addRealTimeNotification: (state, action: PayloadAction<NotificationPayload>) => {
      // Inyectamos la nueva notificación al principio del arreglo
      state.list.unshift(action.payload);
    },
    clearNotifications: (state) => {
      state.list = [];
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state) => { state.isLoading = true; })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.isLoading = false;
        state.list = action.payload;
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Actualización optimista de UI al marcar una como leída
      .addCase(markNotificationRead.fulfilled, (state, action) => {
        const index = state.list.findIndex(n => n.Id === action.payload);
        if (index !== -1) {
          state.list[index].Leido = "1";
        }
      })
      // Actualización optimista al marcar todas
      .addCase(markAllNotificationsRead.fulfilled, (state) => {
        state.list.forEach(n => n.Leido = "1");
      });
  },
});

export const { addRealTimeNotification, clearNotifications } = notificationsSlice.actions;

export const selectAllNotifications = (state: RootState) => state.notifications.list;
export const selectUnreadNotificationsCount = (state: RootState) => state.notifications.list.filter(n => n.Leido === "0").length;

export default notificationsSlice.reducer;