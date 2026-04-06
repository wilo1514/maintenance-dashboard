import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { type RootState } from '../../app/store';
import api from '../../services/api';
import { TECH_ENDPOINTS } from '../../services/endpoints/tech';

export interface Transfer {
  id: string; 
  idReal: number; 
  nroInterno: number | null;
  nroDocumento: number | null;
  fecha: string;
  numero: string;
  tipo: string;   
  estado: string; 
  ubicacionOrigen: string; 
  ubicacionDestino: string; 
  ordenMantenimiento?: string; 
}

export interface ApiTransferResponse {
  id: number;
  nroInterno: number | null;   
  nroDocumento: number | null; 
  nroTransferencia: number | null; 
  nroSolicitud: number | null;     
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
  servicioTecnico?: string; 
}

export const fetchTransfers = createAsyncThunk(
  'transfers/fetchTransfers', 
  async (params: FetchTransfersParams, { getState, rejectWithValue }) => {
    try {
      const state = getState() as RootState;
      const user = state.auth.user;
      const isFT1 = user?.ubicacion === '05-FT1';

      const queryParams = new URLSearchParams({
        pagina: params.page.toString(),
        recordsPorPagina: params.limit.toString(),
        soloConNroInterno: isFT1 ? 'false' : 'true'
      });

      // 🚨 AQUÍ ESTÁ EL CAMBIO CLAVE: 'bodega' y 'ubicacion' 🚨
      if (!isFT1 && user?.idbranch && user?.ubicacion) {
        queryParams.append('bodega', user.idbranch);       // Antes era bodegaHasta
        queryParams.append('ubicacion', user.ubicacion);   // Antes era ubicacionHasta
      }

      // Si es FT1 y filtró por un servicio técnico específico
      if (isFT1 && params.servicioTecnico) {
        queryParams.append('ubicacion', params.servicioTecnico);
      }

      if (params.fechaDesde) queryParams.append('fechaDesde', params.fechaDesde);
      if (params.fechaHasta) queryParams.append('fechaHasta', params.fechaHasta);
      if (params.numero) queryParams.append('codigoTransferencia', params.numero);
      if (params.estado && params.estado !== 'TODOS') queryParams.append('estado', params.estado);

      // Usamos el endpoint limpio
      const response = await api.get<ApiTransferResponse[]>(`${TECH_ENDPOINTS.GET_TRANSFERS}?${queryParams.toString()}`);
      
      const transferenciasOrdenadas = response.data.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

      const dataTransformada: Transfer[] = transferenciasOrdenadas.map((t) => {
        let estadoLegible = t.estado ? t.estado.toUpperCase() : 'PENDIENTE';
        if (estadoLegible === 'P') estadoLegible = 'PENDIENTE';
        if (estadoLegible === 'A') estadoLegible = 'APROBADO';

        return {
          id: t.id.toString(), 
          idReal: t.id,
          nroInterno: t.nroInterno,
          nroDocumento: t.nroDocumento,              
          fecha: t.fecha ? t.fecha.split('T')[0] : 'Sin fecha',               
          numero: t.nroDocumento ? t.nroDocumento.toString() : (t.nroInterno ? `INT-${t.nroInterno}` : 'Borrador'),          
          tipo: t.tipo ? t.tipo.toUpperCase() : 'TRF',                 
          estado: estadoLegible,
          ubicacionOrigen: t.ubicacionDesde,
          ubicacionDestino: t.ubicacionHasta,
          ordenMantenimiento: t.nroServicio ? t.nroServicio.toString() : undefined
        };
      });

      return { data: dataTransformada, total: dataTransformada.length, pages: 1 };
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
      .addCase(fetchTransfers.pending, (state) => { state.isLoading = true; state.error = null; })
      .addCase(fetchTransfers.fulfilled, (state, action) => {
        state.isLoading = false; state.list = action.payload.data; state.totalItems = action.payload.total; state.totalPages = action.payload.pages;
      })
      .addCase(fetchTransfers.rejected, (state, action) => { state.isLoading = false; state.error = action.payload as string; });
  },
});

export const selectAllTransfers = (state: RootState) => state.techTransfers.list;
export const selectTransfersLoading = (state: RootState) => state.techTransfers.isLoading;
export const selectTransfersTotalPages = (state: RootState) => state.techTransfers.totalPages;

export default transfersSlice.reducer;