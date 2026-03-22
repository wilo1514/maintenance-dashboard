import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { type RootState } from '../../app/store';
import api from '../../services/api';
import { TECH_ENDPOINTS } from '../../services/endpoints/tech';

// 1. INTERFACES DE C# (BACKEND)
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
  bodega: string;
  ubicacion: string;
  fecha: string;
  nroServicio: string | null;
  estado: string;
  tipo: string;
  details: ApiTransferDetailItem[];
}

// 2. INTERFACES DE REACT (FRONTEND)
export interface TransferItem {
  id: string; 
  originalId?: number; 
  itemCode: string;
  descripcion: string;
  cantidadPedida: number;
  cantidadRecibida: number; 
  isAccepted: boolean; 
}

// NUEVO NOMBRE PARA FORZAR A VS CODE A REINICIAR EL CACHÉ
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

// --- GET: OBTENER TRANSFERENCIA E ÍTEMS ---
export const fetchTransferItems = createAsyncThunk(
  'transferItems/fetchItems', 
  async (transferId: string, { rejectWithValue }) => {
    try {
      const response = await api.get<ApiTransferDetailResponse>(TECH_ENDPOINTS.GET_TRANSFER_BY_ID(transferId));
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) return rejectWithValue(error.response?.data?.message || 'Error al recuperar los ítems');
      return rejectWithValue('Error desconocido');
    }
  }
);

// --- POST / PUT: ACEPTAR Y ENVIAR TRANSFERENCIA ---
export const acceptTransfer = createAsyncThunk(
  'transferItems/acceptTransfer', 
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

      if (header.id === 0) {
        // MODO POST
        const postPayload = {
          bodega: header.bodega,
          ubicacion: header.ubicacion,
          fecha: header.fecha,
          estado: 'P', 
          tipo: header.tipo,
          nroInterno: header.nroInterno,
          nroDocumento: header.nroDocumento,
          details: mappedDetails
        };
        await api.post(TECH_ENDPOINTS.POST_TRANSFER, postPayload);
      } else {
        // MODO PUT 
        const putPayload = {
          id: header.id,
          bodega: header.bodega,
          ubicacion: header.ubicacion,
          fecha: header.fecha,
          nroServicio: header.nroServicio, 
          estado: 'P',
          tipo: header.tipo,
          details: mappedDetails
        };
        await api.put(TECH_ENDPOINTS.PUT_TRANSFER, putPayload);
      }

      return true;
    } catch (error) {
      if (axios.isAxiosError(error)) return rejectWithValue(error.response?.data?.message || 'Error al procesar la transferencia');
      return rejectWithValue('Error desconocido');
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
      
      .addCase(acceptTransfer.pending, (state) => { state.isSubmitting = true; })
      .addCase(acceptTransfer.fulfilled, (state) => { state.isSubmitting = false; })
      .addCase(acceptTransfer.rejected, (state, action) => { state.isSubmitting = false; state.error = action.payload as string; });
  },
});

export const { clearItems } = transferItemsSlice.actions;

export const selectTransferHeader = (state: RootState) => state.techTransferItems.currentHeader;
export const selectTransferItems = (state: RootState) => state.techTransferItems.currentItems;
export const selectItemsLoading = (state: RootState) => state.techTransferItems.isLoading;
export const selectIsSubmitting = (state: RootState) => state.techTransferItems.isSubmitting;

export default transferItemsSlice.reducer;