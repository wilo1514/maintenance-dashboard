import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { type RootState } from '../../app/store';
import api from '../../services/api';
import { TECH_ENDPOINTS } from '../../services/endpoints/tech';

export interface ApiTransferDetailItem {
  id?: number; 
  item: string;
  descripcion: string;
  cantidad: number;
  cantidadRecibida: number;
}

export interface ApiTransferDetailResponse {
  id: number;
  nroInterno: number | null;
  nroDocumento: number | null;
  bodegaDesde: string;
  ubicacionDesde: string;
  bodegaHasta: string;
  ubicacionHasta: string;
  fecha: string;
  nroServicio: string | null;
  estado: string;
  tipo: string;
  details: ApiTransferDetailItem[];
}

export interface TransferItem {
  id: string; 
  originalId?: number; 
  itemCode: string;
  descripcion: string;
  cantidadPedida: number;
  cantidadRecibida: number; 
  isAccepted: boolean; 
}

export interface ITransferItemsState {
  currentHeader: ApiTransferDetailResponse | null; 
  currentItems: TransferItem[];
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
}

const initialState: ITransferItemsState = {
  currentHeader: null,
  currentItems: [],
  isLoading: false,
  isSubmitting: false,
  error: null,
};

export const fetchTransferItems = createAsyncThunk(
  'transferItems/fetchItems', 
  async (transferId: string, { rejectWithValue }) => {
    try {
      let endpoint = '';
      if (transferId.startsWith('0-')) {
        const docEntry = transferId.split('-')[1]; 
        endpoint = `/transferencias/0?docEntry=${docEntry}`;
      } else {
        endpoint = `/transferencias/${transferId}`;
      }
      const response = await api.get<ApiTransferDetailResponse>(endpoint);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) return rejectWithValue(error.response?.data?.message || 'Error al recuperar los ítems');
      return rejectWithValue('Error desconocido');
    }
  }
);

// --- ACCIÓN 1: GUARDAR (POST) O ACTUALIZAR (PUT) ---
export const saveTransfer = createAsyncThunk(
  'transferItems/saveTransfer', 
  async (payload: { header: ApiTransferDetailResponse, items: TransferItem[] }, { rejectWithValue }) => {
    try {
      const { header, items } = payload;
      
      const mappedDetails = items.map((i) => {
        const detail: ApiTransferDetailItem = {
          item: i.itemCode,
          descripcion: i.descripcion,
          cantidad: i.cantidadPedida,
          cantidadRecibida: i.cantidadRecibida
        };
        if (header.id !== 0 && i.originalId) {
          detail.id = i.originalId;
        }
        return detail;
      });

      // Creamos el Payload Base (lo que comparten POST y PUT)
      const basePayload: Record<string, unknown> = {
        bodegaDesde: header.bodegaDesde,
        ubicacionDesde: header.ubicacionDesde,
        bodegaHasta: header.bodegaHasta,
        ubicacionHasta: header.ubicacionHasta,
        fecha: header.fecha,
        estado: 'P', 
        tipo: header.tipo,
        details: mappedDetails
      };

      // Agregamos nroServicio SOLO si existe
      if (header.nroServicio) {
        basePayload.nroServicio = header.nroServicio;
      }

      if (header.id === 0) {
        // MODO POST (Agregamos nroInterno y nroDocumento)
        const postPayload = {
          ...basePayload,
          nroInterno: header.nroInterno || 0,
          nroDocumento: header.nroDocumento || 0,
        };
        await api.post(TECH_ENDPOINTS.POST_TRANSFER, postPayload);
      } else {
        // MODO PUT (Agregamos el ID en el body y usamos la ruta con ID)
        const putPayload = {
          ...basePayload,
          id: header.id,
        };
        await api.put(TECH_ENDPOINTS.PUT_TRANSFER(header.id), putPayload);
      }

      return true;
    } catch (error) {
      if (axios.isAxiosError(error)) return rejectWithValue(error.response?.data?.message || 'Error al guardar la transferencia');
      return rejectWithValue('Error desconocido al guardar');
    }
  }
);

// --- ACCIÓN 2: AUTORIZAR HACIA SAP ---
export const authorizeSapTransfer = createAsyncThunk(
  'transferItems/authorizeSapTransfer', 
  async (payload: { header: ApiTransferDetailResponse, items: TransferItem[], comentarios: string }, { rejectWithValue }) => {
    try {
      const { header, items, comentarios } = payload;
      
      const detallesSap = items.map((i) => ({
        itemCode: i.itemCode,
        quantity: i.cantidadRecibida // Enviamos lo que el usuario verificó
      }));

      const sapPayload: Record<string, unknown> = {
        nroInterno: header.nroInterno || 0,
        fecha: header.fecha,
        bodegaDesde: header.bodegaDesde,
        ubicacionDesde: header.ubicacionDesde,
        bodegaHasta: header.bodegaHasta,
        ubicacionHasta: header.ubicacionHasta,
        estado: 'A',
        comentarios: comentarios,
        detalles: detallesSap
      };

      if (header.nroServicio) {
        sapPayload.nroServicio = header.nroServicio;
      }

      await api.post(TECH_ENDPOINTS.POST_SAP_TRANSFER, sapPayload);
      return true;
    } catch (error) {
      if (axios.isAxiosError(error)) return rejectWithValue(error.response?.data?.message || 'Error al autorizar en SAP');
      return rejectWithValue('Error desconocido en SAP');
    }
  }
);

export const transferItemsSlice = createSlice({
  name: 'transferItems',
  initialState,
  reducers: {
    clearItems: (state) => {
      state.currentHeader = null;
      state.currentItems = [];
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // GET
      .addCase(fetchTransferItems.pending, (state) => { state.isLoading = true; state.error = null; })
      .addCase(fetchTransferItems.fulfilled, (state, action) => { 
        state.isLoading = false; 
        state.currentHeader = action.payload; 
        state.currentItems = action.payload.details.map((d: ApiTransferDetailItem) => ({
          id: d.id ? d.id.toString() : d.item, 
          originalId: d.id,
          itemCode: d.item,
          descripcion: d.descripcion,
          cantidadPedida: d.cantidad,
          cantidadRecibida: d.cantidadRecibida || 0, 
          isAccepted: false
        }));
      })
      .addCase(fetchTransferItems.rejected, (state, action) => { state.isLoading = false; state.error = action.payload as string; })
      
      // SAVE (POST/PUT)
      .addCase(saveTransfer.pending, (state) => { state.isSubmitting = true; })
      .addCase(saveTransfer.fulfilled, (state) => { state.isSubmitting = false; })
      .addCase(saveTransfer.rejected, (state, action) => { state.isSubmitting = false; state.error = action.payload as string; })
      
      // AUTHORIZE (SAP)
      .addCase(authorizeSapTransfer.pending, (state) => { state.isSubmitting = true; })
      .addCase(authorizeSapTransfer.fulfilled, (state) => { state.isSubmitting = false; })
      .addCase(authorizeSapTransfer.rejected, (state, action) => { state.isSubmitting = false; state.error = action.payload as string; });
  },
});

export const { clearItems } = transferItemsSlice.actions;

export const selectTransferHeader = (state: RootState) => 
  (state.techTransferItems as ITransferItemsState).currentHeader;
export const selectTransferItems = (state: RootState) => 
  (state.techTransferItems as ITransferItemsState).currentItems;
export const selectItemsLoading = (state: RootState) => 
  (state.techTransferItems as ITransferItemsState).isLoading;
export const selectIsSubmitting = (state: RootState) => 
  (state.techTransferItems as ITransferItemsState).isSubmitting;

export default transferItemsSlice.reducer;