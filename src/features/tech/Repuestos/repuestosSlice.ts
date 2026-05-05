import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { type RootState } from '../../../app/store';
import api from '../../../services/api';
import { TECH_ENDPOINTS } from '../../../services/endpoints/tech';

export interface SapItem {
  itemCode: string;
  itemName: string;
  onHandQty: number;
}

interface RepuestosState {
  list: SapItem[];
  isLoading: boolean;
  error: string | null;
}

const initialState: RepuestosState = {
  list: [],
  isLoading: false,
  error: null,
};

interface FetchRepuestosParams {
  whsCode: string;
  binLocation: string;
  codigo?: string;
  nombre?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const extractData = (rawData: any): any[] => {
  if (!rawData) return [];
  if (Array.isArray(rawData)) return rawData;
  if (Array.isArray(rawData.items)) return rawData.items;
  if (Array.isArray(rawData.value)) return rawData.value;
  if (Array.isArray(rawData.data)) return rawData.data;
  if (rawData.itemCode) return [rawData]; // Si devuelve un solo objeto
  return [];
};

export const fetchRepuestos = createAsyncThunk(
  'repuestos/fetchRepuestos',
  async (params: FetchRepuestosParams, { rejectWithValue }) => {
    try {
      const { whsCode, binLocation, codigo, nombre } = params;
      const baseParams = `?top=50&skip=0&whsCode=${whsCode}&binLocation=${binLocation}`;

      let url = `${TECH_ENDPOINTS.GET_SAP_REPUESTOS}${baseParams}`;

      if (codigo && codigo.trim() !== '') {
        const encodedCode = encodeURIComponent(codigo.trim().toUpperCase());
        url = `${TECH_ENDPOINTS.SEARCH_SAP_REPUESTOS_ID(encodedCode)}${baseParams}`;
      } 
      else if (nombre && nombre.trim() !== '') {
        const encodedName = encodeURIComponent(nombre.trim().toUpperCase());
        url = `${TECH_ENDPOINTS.SEARCH_SAP_REPUESTOS_NOMBRE}${baseParams}&nombre=${encodedName}`;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await api.get<any>(url);
      const rawItems = extractData(response.data);

      // Mapeamos los datos al formato limpio de la interfaz
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items: SapItem[] = rawItems.map((item: any) => ({
        itemCode: item.itemCode || item.ItemCode || '',
        itemName: item.itemName || item.ItemName || 'Sin descripción',
        onHandQty: item.onHandQty || item.OnHandQty || 0,
      }));

      return items;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) return [];
        return rejectWithValue(error.response?.data?.message || 'Error al conectar con SAP');
      }
      return rejectWithValue('Error desconocido al buscar repuestos');
    }
  }
);

export const repuestosSlice = createSlice({
  name: 'repuestos',
  initialState,
  reducers: {
    clearRepuestos: (state) => {
      state.list = [];
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRepuestos.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchRepuestos.fulfilled, (state, action) => {
        state.isLoading = false;
        state.list = action.payload;
      })
      .addCase(fetchRepuestos.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearRepuestos } = repuestosSlice.actions;

export const selectAllRepuestos = (state: RootState) => state.techRepuestos.list;
export const selectRepuestosLoading = (state: RootState) => state.techRepuestos.isLoading;

export default repuestosSlice.reducer;
