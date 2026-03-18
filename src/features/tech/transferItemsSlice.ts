import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { type RootState } from '../../app/store';
// import api from '../../services/api';

export interface TransferItem {
  id: string;
  itemCode: string;
  descripcion: string;
  cantidadPedida: number;
  cantidadRecibida: number; 
  isAccepted: boolean; 
}

interface TransferItemsState {
  currentItems: TransferItem[];
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
}

const initialState: TransferItemsState = {
  currentItems: [],
  isLoading: false,
  isSubmitting: false,
  error: null,
};

const generateMockItems = (): TransferItem[] => [
  { id: 'item-1', itemCode: 'SAP-10045', descripcion: 'Filtro de Aceite Industrial', cantidadPedida: 12, cantidadRecibida: 12, isAccepted: false },
  { id: 'item-2', itemCode: 'SAP-88210', descripcion: 'Banda de Transmisión Tipo B', cantidadPedida: 4, cantidadRecibida: 4, isAccepted: false },
  { id: 'item-3', itemCode: 'SAP-33011', descripcion: 'Rodamiento de Bolas Sellado', cantidadPedida: 50, cantidadRecibida: 50, isAccepted: false },
];

export const fetchTransferItems = createAsyncThunk('transferItems/fetchItems', async (transferId: string, { rejectWithValue }) => {
  try {
    // API REAL (Descomentar cuando esté lista):
    // const response = await api.get(`/tech/transfers/${transferId}/items`);
    // return response.data;
    return new Promise<TransferItem[]>((resolve) => setTimeout(() => resolve(generateMockItems()), 500));
  } catch (error) {
    if (axios.isAxiosError(error)) {
      return rejectWithValue(error.response?.data?.message || 'Error al recuperar los items');
    }
    return rejectWithValue('Error desconocido');
  }
});

export const acceptTransfer = createAsyncThunk('transferItems/acceptTransfer', async (payload: { transferId: string, items: TransferItem[] }, { rejectWithValue }) => {
  try {
    // API REAL (Descomentar cuando esté lista):
    // const response = await api.post(`/tech/transfers/${payload.transferId}/accept`, { items: payload.items });
    // return response.data;
    return new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 1000));
  } catch (error) {
    if (axios.isAxiosError(error)) {
      return rejectWithValue(error.response?.data?.message || 'Error al aceptar la trasferencia');
    }
    return rejectWithValue('Error desconocido');
  }
});

export const transferItemsSlice = createSlice({
  name: 'transferItems',
  initialState,
  reducers: {
    // Podemos agregar un reducer para limpiar la vista cuando el usuario sale
    clearItems: (state) => {
      state.currentItems = [];
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTransferItems.pending, (state) => { state.isLoading = true; state.error = null; })
      .addCase(fetchTransferItems.fulfilled, (state, action) => { state.isLoading = false; state.currentItems = action.payload; })
      .addCase(fetchTransferItems.rejected, (state, action) => { state.isLoading = false; state.error = action.payload as string; })
      
      .addCase(acceptTransfer.pending, (state) => { state.isSubmitting = true; })
      .addCase(acceptTransfer.fulfilled, (state) => { state.isSubmitting = false; })
      .addCase(acceptTransfer.rejected, (state, action) => { state.isSubmitting = false; state.error = action.payload as string; });
  },
});

export const { clearItems } = transferItemsSlice.actions;

export const selectTransferItems = (state: RootState) => state.techTransferItems.currentItems;
export const selectItemsLoading = (state: RootState) => state.techTransferItems.isLoading;
export const selectIsSubmitting = (state: RootState) => state.techTransferItems.isSubmitting;

export default transferItemsSlice.reducer;