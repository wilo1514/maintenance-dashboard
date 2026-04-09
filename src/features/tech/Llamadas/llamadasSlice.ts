import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { type RootState } from '../../../app/store';
import api from '../../../services/api';
import { TECH_ENDPOINTS } from '../../../services/endpoints/tech';

export interface LlamadaDetalle {
  id: number;
  llamadaServicioId: number;
  tipo: string;
  itemDetalleId: number | string;
  cantidad: number;
  costo: number;
  valor: number;
  usuFechaCrea: string;
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
  tecnicoId: number;
  nroSerie: string;
  nroFabricante: string;
  estado: string;
  prioridad: string;
  usuFechaCrea: string;
  usuFechaModifica: string;
  detalles: LlamadaDetalle[];
  anexos: LlamadaAnexo[];
}

interface LlamadasState {
  list: LlamadaServicio[];
  isLoading: boolean;
  isDeleting: boolean;
  error: string | null;
}

const initialState: LlamadasState = {
  list: [],
  isLoading: false,
  isDeleting: false,
  error: null,
};

interface FetchLlamadasParams {
  fechaDesde?: string;
  fechaHasta?: string;
  estado?: string; 
}

export const fetchLlamadas = createAsyncThunk<
  LlamadaServicio[],      
  FetchLlamadasParams,    
  { state: RootState }   
>(
  'llamadas/fetchLlamadas',
  async (params, { getState, rejectWithValue }) => {
    try {
      const state = getState(); 
      const user = state.auth.user; 

      const queryParams = new URLSearchParams();

      if (user?.idbranch) queryParams.append('bodega', user.idbranch);
      if (user?.ubicacion) queryParams.append('ubicacion', user.ubicacion);

      if (params.fechaDesde) queryParams.append('fechaDesde', params.fechaDesde);
      if (params.fechaHasta) queryParams.append('fechaHasta', params.fechaHasta);
      
      if (params.estado && params.estado !== 'TODOS') {
        queryParams.append('estado', params.estado);
      }

      const response = await api.get<LlamadaServicio[]>(`${TECH_ENDPOINTS.GET_LLAMADAS}?${queryParams.toString()}`);
      
      const ordenadas = response.data.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
      
      return ordenadas;
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
      return response.data.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
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
        state.list = action.payload; 
      })
      .addCase(fetchLlamadas.rejected, (state, action) => { 
        state.isLoading = false; 
        state.error = action.payload as string; 
      })
      
      // --- Fetch Llamadas Para Aprobación (¡NUEVO!) ---
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

// Selectores apuntando a `state.techLlamadas` (Intactos para no romper dependencias)
export const selectAllLlamadas = (state: RootState) => state.techLlamadas.list;
export const selectLlamadasLoading = (state: RootState) => state.techLlamadas.isLoading;

export default llamadasSlice.reducer;