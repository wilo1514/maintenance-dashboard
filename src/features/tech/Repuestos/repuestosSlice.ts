import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { type RootState } from '../../../app/store';
import api from '../../../services/api';
import { TECH_ENDPOINTS } from '../../../services/endpoints/tech';

export interface SapItem {
  itemCode: string;
  itemName: string;
  itemsGroupCode?: number;
  whsCode?: string;
  binAbs?: number;
  binCode?: string;
  onHandQty: number;
  avgPrice?: number;
}

interface RepuestosState {
  list: SapItem[];
  count: number;
  top: number;
  skip: number;
  isLoading: boolean;
  error: string | null;
}

const initialState: RepuestosState = {
  list: [],
  count: 0,
  top: 25,
  skip: 0,
  isLoading: false,
  error: null,
};

interface FetchRepuestosParams {
  whsCode: string;
  binLocation: string;
  codigo?: string;
  nombre?: string;
  top?: number;
  skip?: number;
}

interface RepuestosResponse {
  items: SapItem[];
  count: number;
  top: number;
  skip: number;
}

const extractData = (rawData: any): any[] => {
  if (!rawData) return [];
  if (Array.isArray(rawData)) return rawData;
  if (Array.isArray(rawData.items)) return rawData.items;
  if (Array.isArray(rawData.value)) return rawData.value;
  if (Array.isArray(rawData.data)) return rawData.data;
  if (rawData.itemCode) return [rawData];
  return [];
};

export const fetchRepuestos = createAsyncThunk<RepuestosResponse, FetchRepuestosParams, { rejectValue: string }>(
  'repuestos/fetchRepuestos',
  async (params, { rejectWithValue }) => {
    try {
      const { whsCode, binLocation, codigo, nombre, top = 25, skip = 0 } = params;
      const baseParams = `?top=${top}&skip=${skip}&whsCode=${encodeURIComponent(whsCode)}&binLocation=${encodeURIComponent(binLocation)}`;

      let url = `${TECH_ENDPOINTS.GET_SAP_REPUESTOS}${baseParams}`;

      if (codigo && codigo.trim() !== '') {
        const encodedCode = encodeURIComponent(codigo.trim().toUpperCase());
        url = `${TECH_ENDPOINTS.SEARCH_SAP_REPUESTOS_ID(encodedCode)}${baseParams}`;
      } else if (nombre && nombre.trim() !== '') {
        const encodedName = encodeURIComponent(nombre.trim().toUpperCase());
        url = `${TECH_ENDPOINTS.SEARCH_SAP_REPUESTOS_NOMBRE}${baseParams}&nombre=${encodedName}`;
      }

      const response = await api.get<any>(url);
      const rawItems = extractData(response.data);

      const items: SapItem[] = rawItems.map((item: any) => ({
        itemCode: item.itemCode || item.ItemCode || '',
        itemName: item.itemName || item.ItemName || 'Sin descripcion',
        itemsGroupCode: item.itemsGroupCode || item.ItemsGroupCode || 0,
        whsCode: item.whsCode || item.WhsCode || '',
        binAbs: item.binAbs || item.BinAbs || 0,
        binCode: item.binCode || item.BinCode || '',
        onHandQty: item.onHandQty || item.OnHandQty || 0,
        avgPrice: item.avgPrice || item.AvgPrice || 0,
      }));

      return {
        items,
        count: typeof response.data?.count === 'number' ? response.data.count : rawItems.length,
        top: typeof response.data?.top === 'number' ? response.data.top : top,
        skip: typeof response.data?.skip === 'number' ? response.data.skip : skip,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          return { items: [], count: 0, top: params.top || 25, skip: params.skip || 0 };
        }
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
      state.count = 0;
      state.skip = 0;
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
        state.list = action.payload.items;
        state.count = action.payload.count;
        state.top = action.payload.top;
        state.skip = action.payload.skip;
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
export const selectRepuestosCount = (state: RootState) => state.techRepuestos.count;

export default repuestosSlice.reducer;
