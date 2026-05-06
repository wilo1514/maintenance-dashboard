import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { type RootState } from '../../../app/store';
import api from '../../../services/api';
import { TECH_ENDPOINTS } from '../../../services/endpoints/tech';

export interface LlamadaDetalle {
  id?: number;               // Opcional al crear
  llamadaServicioId?: number; // Opcional al crear
  tipo: string;
  itemDetalleId?: string | number;
  itemSAP?: string;
  descripcion?: string;
  cantidad: number;
  costo: number;
  valor: number;
  usuFechaCrea?: string;     // Opcional al crear
}

export interface LlamadaAnexo {
  id: number;
  llamadaServicioId: number;
  ruta: string;
  nombre: string;
  url: string;
  tipo: string;
  usuFechaCrea: string;
}

export interface LlamadaServicio {
  id: number;
  clienteSAPId: string;
  proveedorSAPId: string;
  fecha: string;
  bodega: string;
  ubicacion: string;
  origenLLSId: number;
  tipoLLSId: number;
  clienteId: string;
  itemIncidenciaId: string;
  motivoIncidenciaSTId: number;
  tipoProblemaSTId: string;
  subtipoProblemaSTId: string;
  solucionSTId?: number;
  nroDocumento?: number;
  nroInterno?: number;
  nroDetallesServicio: number;
  tecnicoId: number;
  nroSerie: string;
  nroFabricante: string;
  estado: string;
  prioridad: string;
  
 
  ordenCompraGenerada?: boolean;
  ordenCompraEnviadaSap?: boolean;
  ordenCompraId?: number | null;
  ordenCompraNroInterno?: number | null;
  ordenCompraNroDocumento?: number | null;
  estadoOrdenCompraSap?: string | null;
  
  salidaMercanciaGenerada?: boolean;
  salidaMercanciaEnviadaSap?: boolean;
  salidaMercanciaId?: number | null;
  salidaMercanciaNroInterno?: number | null;
  salidaMercanciaNroDocumento?: number | null;
  estadoSalidaMercanciaSap?: string | null;

  usuFechaCrea: string;
  usuFechaModifica: string;
  detalles: LlamadaDetalle[];
  anexos: LlamadaAnexo[];
}

interface LlamadasState {
  list: LlamadaServicio[];
  totalItems: number;
  totalPages: number;
  isLoading: boolean;
  isDeleting: boolean;
  error: string | null;
}

const initialState: LlamadasState = {
  list: [],
  totalItems: 0,
  totalPages: 1,
  isLoading: false,
  isDeleting: false,
  error: null,
};

interface FetchLlamadasParams {
  fechaDesde?: string;
  fechaHasta?: string;
  estado?: string; 
  allLocations?: boolean;
  pagina?: number;
  recordsPorPagina?: number;
}

interface FetchLlamadasResponse {
  data: LlamadaServicio[];
  totalItems: number;
  totalPages: number;
}

const extractLlamadasData = (rawData: unknown): LlamadaServicio[] => {
  if (Array.isArray(rawData)) return rawData;
  if (rawData && typeof rawData === 'object') {
    const data = rawData as { items?: LlamadaServicio[]; registros?: LlamadaServicio[]; data?: LlamadaServicio[] };
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.registros)) return data.registros;
    if (Array.isArray(data.data)) return data.data;
  }
  return [];
};

const extractCount = (rawData: unknown) => {
  if (!rawData || typeof rawData !== 'object') return 0;
  const data = rawData as { count?: unknown; total?: unknown; totalItems?: unknown; totalRegistros?: unknown };
  const value = data.count ?? data.total ?? data.totalItems ?? data.totalRegistros;
  return typeof value === 'number' ? value : 0;
};

export const fetchLlamadas = createAsyncThunk<
  FetchLlamadasResponse,
  FetchLlamadasParams,
  { state: RootState }
>(
  'llamadas/fetchLlamadas',
  async (params, { getState, rejectWithValue }) => {
    try {
      const state = getState(); 
      const user = state.auth.user; 

      const queryParams = new URLSearchParams();
      const pagina = params.pagina || 1;
      const recordsPorPagina = params.recordsPorPagina || 15;
      queryParams.append('pagina', String(pagina));
      queryParams.append('recordsPorPagina', String(recordsPorPagina));

      if (!params.allLocations) {
        if (user?.idbranch) queryParams.append('bodega', user.idbranch);
        if (user?.ubicacion) queryParams.append('ubicacion', user.ubicacion);
      }

      if (params.fechaDesde) queryParams.append('fechaDesde', params.fechaDesde);
      if (params.fechaHasta) queryParams.append('fechaHasta', params.fechaHasta);
      
      if (params.estado && params.estado !== 'TODOS') {
        queryParams.append('estado', params.estado);
      }

      const response = await api.get<unknown>(`${TECH_ENDPOINTS.GET_LLAMADAS}?${queryParams.toString()}`);
      
      const llamadasData = extractLlamadasData(response.data);
      const ordenadas = llamadasData.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
      const apiCount = extractCount(response.data);
      const totalItems = Math.max(apiCount, (pagina - 1) * recordsPorPagina + ordenadas.length);
      const hasNextPage = ordenadas.length === recordsPorPagina;
      
      return {
        data: ordenadas,
        totalItems,
        totalPages: Math.max(Math.ceil(totalItems / recordsPorPagina), pagina + (hasNextPage ? 1 : 0), 1),
      };
    } catch (error) {
      if (axios.isAxiosError(error)) return rejectWithValue(error.response?.data?.message || 'Error al cargar las órdenes de servicio');
      return rejectWithValue('Error desconocido');
    }
  }
);

export const deleteLlamada = createAsyncThunk(
  'llamadas/deleteLlamada',
  async (id: number, { rejectWithValue }) => {
    try {
      await api.delete(TECH_ENDPOINTS.DELETE_LLAMADA(id));
      return id; 
    } catch (error) {
      if (axios.isAxiosError(error)) return rejectWithValue(error.response?.data?.message || 'Error al eliminar la orden');
      return rejectWithValue('Error desconocido al eliminar');
    }
  }
);

export const fetchLlamadasParaAprobacion = createAsyncThunk<
  LlamadaServicio[], 
  void, 
  { state: RootState }
>(
  'llamadas/fetchParaAprobacion',
  async (_, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('estado', 'P'); // Solo pendientes

      const response = await api.get<LlamadaServicio[]>(`${TECH_ENDPOINTS.GET_LLAMADAS}?${queryParams.toString()}`);
      
      const filtradas = response.data.filter(os => os.nroDetallesServicio > 0);

      return filtradas.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    } catch (error) {
      if (axios.isAxiosError(error)) return rejectWithValue(error.response?.data?.message || 'Error al cargar aprobaciones');
      return rejectWithValue('Error desconocido');
    }
  }
);

export const llamadasSlice = createSlice({
  name: 'llamadas',
  initialState,
  reducers: {
    clearLlamadas: (state) => {
      state.list = [];
      state.totalItems = 0;
      state.totalPages = 1;
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // --- Fetch Llamadas Normal ---
      .addCase(fetchLlamadas.pending, (state) => { 
        state.isLoading = true; 
        state.error = null; 
      })
      .addCase(fetchLlamadas.fulfilled, (state, action) => { 
        state.isLoading = false; 
        state.list = action.payload.data;
        state.totalItems = action.payload.totalItems;
        state.totalPages = action.payload.totalPages;
      })
      .addCase(fetchLlamadas.rejected, (state, action) => { 
        state.isLoading = false; 
        state.error = action.payload as string; 
      })
      
      .addCase(fetchLlamadasParaAprobacion.pending, (state) => { 
        state.isLoading = true; 
        state.error = null; 
      })
      .addCase(fetchLlamadasParaAprobacion.fulfilled, (state, action) => { 
        state.isLoading = false; 
        state.list = action.payload; 
      })
      .addCase(fetchLlamadasParaAprobacion.rejected, (state, action) => { 
        state.isLoading = false; 
        state.error = action.payload as string; 
      })

      // --- Delete Llamada ---
      .addCase(deleteLlamada.pending, (state) => { 
        state.isDeleting = true; 
      })
      .addCase(deleteLlamada.fulfilled, (state, action) => {
        state.isDeleting = false;
        state.list = state.list.filter(ll => ll.id !== action.payload);
      })
      .addCase(deleteLlamada.rejected, (state, action) => { 
        state.isDeleting = false; 
        state.error = action.payload as string; 
      });
  },
});

export const { clearLlamadas } = llamadasSlice.actions;

// Selectores apuntando a `state.techLlamadas`
export const selectAllLlamadas = (state: RootState) => state.techLlamadas.list;
export const selectLlamadasLoading = (state: RootState) => state.techLlamadas.isLoading;
export const selectLlamadasTotalPages = (state: RootState) => state.techLlamadas.totalPages;
export const selectLlamadasTotalItems = (state: RootState) => state.techLlamadas.totalItems;

export default llamadasSlice.reducer;
