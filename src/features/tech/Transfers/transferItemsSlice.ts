import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { type RootState } from '../../../app/store';
import api from '../../../services/api';
import { TECH_ENDPOINTS } from '../../../services/endpoints/tech';

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
  // AHORA ACEPTA STRING temporalmente para permitir que el campo esté vacío ("") mientras el usuario borra
  cantidadRecibida: number | string; 
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

// --- HELPER: MANEJO DE ERRORES RFC 9110 DE .NET ---
const parseDotNetError = (error: unknown, defaultMessage: string) => {
  if (axios.isAxiosError(error) && error.response) {
    const data = error.response.data;
    
    // Si el servidor nos manda el formato RFC 9110 (Problem Details)
    if (data && data.detail) {
      const detailMsg = data.detail.toString();
      
      // Regla de Negocio: Error de duplicado en SAP
      if (detailMsg.includes('Ya existe una transferencia SAP')) {
        return 'La transferencia ya se registró en SAP previamente.';
      }
      // Retornamos el detalle específico que mandó el servidor
      return detailMsg;
    }
    
    // Si manda un mensaje simple
    if (data && data.message) return data.message;
  }
  
  // Si no hay respuesta (servidor caído o sin internet)
  if (axios.isAxiosError(error) && !error.response) {
    return 'Error de red. Verifique su conexión al servidor.';
  }

  return defaultMessage;
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
      return rejectWithValue(parseDotNetError(error, 'Error al recuperar los ítems'));
    }
  }
);

// --- ACCIÓN 1: GUARDAR (POST) O ACTUALIZAR (PUT) LOCAL SQL ---
export const saveTransfer = createAsyncThunk(
  'transferItems/saveTransfer', 
  async (payload: { header: ApiTransferDetailResponse, items: TransferItem[], estadoForce?: string }, { rejectWithValue }) => {
    try {
      const { header, items, estadoForce } = payload;
      
      const mappedDetails = items.map((i) => {
        const detail: ApiTransferDetailItem = {
          item: i.itemCode,
          descripcion: i.descripcion,
          cantidad: i.cantidadPedida,
          cantidadRecibida: typeof i.cantidadRecibida === 'string' ? (parseInt(i.cantidadRecibida) || 0) : i.cantidadRecibida
        };
        if (header.id !== 0 && i.originalId) {
          detail.id = i.originalId;
        }
        return detail;
      });

      const basePayload: Record<string, unknown> = {
        bodegaDesde: header.bodegaDesde,
        ubicacionDesde: header.ubicacionDesde,
        bodegaHasta: header.bodegaHasta,
        ubicacionHasta: header.ubicacionHasta,
        fecha: header.fecha, 
        estado: estadoForce || 'P', 
        tipo: header.tipo,
        details: mappedDetails
      };

      if (header.nroServicio) {
        basePayload.nroServicio = header.nroServicio;
      }

      if (header.id === 0) {
        // MODO POST
        const postPayload = {
          ...basePayload,
          nroInterno: header.nroInterno || 0,
          nroDocumento: header.nroDocumento || 0,
        };
        const response = await api.post(TECH_ENDPOINTS.POST_TRANSFER, postPayload);
        
        // Retornamos el nuevo ID. (Manejamos si el backend devuelve un objeto {id: 15} o el número directo 15)
        const newId = response.data?.id || response.data; 
        return newId; 

      } else {
        // MODO PUT
        const putPayload = {
          ...basePayload,
          id: header.id,
        };
        await api.put(TECH_ENDPOINTS.PUT_TRANSFER(header.id), putPayload);
        
        // Retornamos el ID que ya teníamos
        return header.id;
      }
    } catch (error) {
      return rejectWithValue(parseDotNetError(error, 'Error al guardar la transferencia'));
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
        quantity: typeof i.cantidadRecibida === 'string' ? (parseInt(i.cantidadRecibida) || 0) : i.cantidadRecibida
      }));

      // REGLA: Fecha actual al momento de enviar a SAP
      const fechaActualIso = new Date().toISOString(); 

      const sapPayload: Record<string, unknown> = {
        nroInterno: header.nroInterno || 0,
        nroDocumento: header.nroDocumento || 0, // SAP Pide esto también
        fecha: fechaActualIso, // FECHA ACTUAL
        bodegaDesde: header.bodegaDesde,
        ubicacionDesde: header.ubicacionDesde,
        bodegaHasta: header.bodegaHasta,
        ubicacionHasta: header.ubicacionHasta,
        estado: 'A', // SIEMPRE A
        comentarios: comentarios || '', // Si no hay comentarios, se envía vacío
        detalles: detallesSap
      };

      if (header.nroServicio) {
        sapPayload.nroServicio = header.nroServicio;
      }

      await api.post(TECH_ENDPOINTS.POST_SAP_TRANSFER, sapPayload);
      return true;
    } catch (error) {
      return rejectWithValue(parseDotNetError(error, 'Error al autorizar en SAP'));
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
          cantidadRecibida: d.cantidadRecibida, 
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