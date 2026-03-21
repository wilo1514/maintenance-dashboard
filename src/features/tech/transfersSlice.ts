import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { type RootState } from '../../app/store';
import api from '../../services/api';
import { TECH_ENDPOINTS } from '../../services/endpoints/tech';

// 1. INTERFAZ DE NUESTRO FRONTEND
// 1. ACTUALIZAMOS EL TIPO DE ESTADO EN EL FRONTEND
export interface Transfer {
  id: string;
  fecha: string;
  numero: string;
  tipo: string;   
  estado: string; // Ej: 'PENDIENTE' | 'PROCESADA' | 'FINALIZADA'
  ordenMantenimiento?: string; 
}

// 2. ACTUALIZAMOS LA INTERFAZ DE C# (Permitiendo nulls)
export interface ApiTransferResponse {
  id: number;
  nroInterno: number | null;   // <-- Ahora acepta null
  nroDocumento: number | null; // <-- Ahora acepta null
  bodega: string;
  ubicacion: string;
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

// --- THUNK CON API REAL Y MAPEADO EXACTO ---
export const fetchTransfers = createAsyncThunk(
  'transfers/fetchTransfers', 
  async (params: FetchTransfersParams, { rejectWithValue }) => {
    try {
      // 1. Armamos los parámetros para el GET
      const queryParams = new URLSearchParams({
        pagina: params.page.toString(),
        recordsPorPagina: params.limit.toString(),
        bodega: '05', 
        ubicacion: '05-FT2' // TODO: Recuperar esta ubicación dinámicamente desde el login
      });

      if (params.fechaDesde) queryParams.append('fechaDesde', params.fechaDesde);
      if (params.fechaHasta) queryParams.append('fechaHasta', params.fechaHasta);
      if (params.numero) queryParams.append('codigoTransferencia', params.numero);
      if (params.estado && params.estado !== 'TODOS') queryParams.append('estado', params.estado);

      // 2. Hacemos la petición esperando el arreglo de ApiTransferResponse
      const response = await api.get<ApiTransferResponse[]>(`${TECH_ENDPOINTS.GET_TRANSFERS}?${queryParams.toString()}`);
      
      const transferencias = response.data;

      // 3. Ordenamos por fecha (más reciente primero)
      const transferenciasOrdenadas = transferencias.sort((a: ApiTransferResponse, b: ApiTransferResponse) => {
        return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
      });

      // 4. MAPEADO MAESTRO CON SALVAVIDAS (NULL CHECKS)
      const dataTransformada: Transfer[] = transferenciasOrdenadas.map((t: ApiTransferResponse) => {
        // Lógica robusta para obtener un ID único sin explotar
        const uniqueId = t.id ? t.id : (t.nroInterno ? t.nroInterno : Math.random());
        
        return {
          id: uniqueId.toString(),                
          fecha: t.fecha ? t.fecha.split('T')[0] : 'Sin fecha',               
          // Si no tiene número de documento, le ponemos "Borrador" o "S/N"
          numero: t.nroDocumento ? t.nroDocumento.toString() : 'Borrador',          
          tipo: t.tipo ? t.tipo.toUpperCase() : 'SAP',                 
          estado: t.estado ? t.estado.toUpperCase() : 'PENDIENTE',             
          ordenMantenimiento: t.nroServicio ? t.nroServicio.toString() : undefined
        };
      });

      // NOTA: Como la respuesta directa es un arreglo [], no tenemos totalRegistros.
      // Calculamos temporalmente el total con el length hasta que el backend envíe metadatos de paginación.
      return {
        data: dataTransformada,
        total: dataTransformada.length,
        pages: 1 // Si el backend no envía el total de páginas, lo dejamos en 1 por ahora
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