import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { type RootState } from '../../app/store';
import api from '../../services/api';
import { TECH_ENDPOINTS } from '../../services/endpoints/tech';

// 1. FRONTEND
export interface Transfer {
  id: string; 
  idReal: number; 
  nroInterno: number | null;
  fecha: string;
  numero: string;
  tipo: string;   
  estado: string; 
  ordenMantenimiento?: string; 
}

// 2. BACKEND 
export interface ApiTransferResponse {
  id: number;
  nroInterno: number | null;   
  nroDocumento: number | null; 
  bodegaDesde: string;
  ubicacionDesde: string;
  bodegaHasta: string;
  ubicacionHasta: string;
  fecha: string;
  nroServicio: string | number | null;
  estado: string;
  tipo: string;
  details: unknown[];
}

interface TransfersState {
  list: Transfer[];
  totalItems: number;
  totalPages: number;
  isLoading: boolean;
  error: string | null;
}

const initialState: TransfersState = {
  list: [],
  totalItems: 0,
  totalPages: 1,
  isLoading: false,
  error: null,
};

interface FetchTransfersParams {
  page: number;
  limit: number;
  fechaDesde?: string;
  fechaHasta?: string;
  numero?: string;
  tipo?: string; 
  estado?: string;
}

export const fetchTransfers = createAsyncThunk(
  'transfers/fetchTransfers', 
  async (params: FetchTransfersParams, { rejectWithValue }) => {
    try {
      // --- ACTUALIZACIÓN SEGÚN EL NUEVO SWAGGER ---
      const queryParams = new URLSearchParams({
        pagina: params.page.toString(),
        recordsPorPagina: params.limit.toString(),
        bodegaHasta: '05',       // <-- CAMBIADO DE bodega A bodegaHasta
        ubicacionHasta: '05-FT2' // <-- CAMBIADO DE ubicacion A ubicacionHasta
        // TODO: Recuperar bodegaHasta y ubicacionHasta dinámicamente en el futuro
      });

      if (params.fechaDesde) queryParams.append('fechaDesde', params.fechaDesde);
      if (params.fechaHasta) queryParams.append('fechaHasta', params.fechaHasta);
      if (params.numero) queryParams.append('codigoTransferencia', params.numero);
      if (params.estado && params.estado !== 'TODOS') queryParams.append('estado', params.estado);

      const response = await api.get<ApiTransferResponse[]>(`${TECH_ENDPOINTS.GET_TRANSFERS}?${queryParams.toString()}`);
      
      const transferencias = response.data;

      const transferenciasOrdenadas = transferencias.sort((a: ApiTransferResponse, b: ApiTransferResponse) => {
        return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
      });

      const dataTransformada: Transfer[] = transferenciasOrdenadas.map((t: ApiTransferResponse) => {
        const uniqueId = t.id !== 0 ? t.id.toString() : `0-${t.nroInterno}`;
        
        return {
          id: uniqueId, 
          idReal: t.id,
          nroInterno: t.nroInterno,               
          fecha: t.fecha ? t.fecha.split('T')[0] : 'Sin fecha',               
          numero: t.nroDocumento ? t.nroDocumento.toString() : 'Borrador',          
          tipo: t.tipo ? t.tipo.toUpperCase() : 'SAP',                 
          estado: t.estado ? t.estado.toUpperCase() : 'PENDIENTE',             
          ordenMantenimiento: t.nroServicio ? t.nroServicio.toString() : undefined
        };
      });

      return {
        data: dataTransformada,
        total: dataTransformada.length,
        pages: 1 
      };

    } catch (error) {
      if (axios.isAxiosError(error)) return rejectWithValue(error.response?.data?.message || 'Error al cargar transferencias');
      return rejectWithValue('Error desconocido');
    }
  }
);

export const transfersSlice = createSlice({
  name: 'transfers',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchTransfers.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchTransfers.fulfilled, (state, action) => {
        state.isLoading = false;
        state.list = action.payload.data;
        state.totalItems = action.payload.total;
        state.totalPages = action.payload.pages;
      })
      .addCase(fetchTransfers.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const selectAllTransfers = (state: RootState) => state.techTransfers.list;
export const selectTransfersLoading = (state: RootState) => state.techTransfers.isLoading;
export const selectTransfersTotalPages = (state: RootState) => state.techTransfers.totalPages;

export default transfersSlice.reducer;