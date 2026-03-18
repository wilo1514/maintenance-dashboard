import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { type RootState } from '../../app/store';

export interface Transfer {
  id: string;
  fecha: string;
  numero: string;
  tipo: 'SAP' | 'STEC';
  estado: 'PENDIENTE' | 'CERRADO' | 'APROBADO' | 'LIQUIDADO';
  ordenMantenimiento?: string; // <-- NUEVO: El "?" significa que puede existir o no
}

// 1. EL ESTADO AHORA SABE CUÁNTAS PÁGINAS HAY EN TOTAL
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

// --- INTERFAZ PARA LOS PARÁMETROS QUE ENVIAMOS AL BACKEND ---
interface FetchTransfersParams {
  page: number;
  limit: number;
  fechaDesde?: string;
  fechaHasta?: string;
  numero?: string;
  tipo?: string;
  estado?: string;
}

// --- GENERADOR DE DATOS FALSOS (Simula la Base de Datos con 45 registros) ---
const MOCK_DB: Transfer[] = Array.from({ length: 45 }, (_, i) => {
  const isSTEC = i % 3 === 0; // Determinamos si es STEC o SAP
  return {
    id: `${i + 1}`,
    fecha: `${String((i % 28) + 1).padStart(2, '0')}/03/2026`,
    numero: `2225055${String(200 + i).padStart(3, '0')}`,
    tipo: isSTEC ? 'STEC' : 'SAP',
    estado: i % 5 === 0 ? 'CERRADO' : (i % 2 === 0 ? 'PENDIENTE' : (i % 3 === 0 ? 'LIQUIDADO' : 'APROBADO')),
    // Si es STEC, le creamos un número de orden. Si es SAP, queda vacío (undefined)
    ordenMantenimiento: isSTEC ? `ORD-${String(1000 + i)}` : undefined 
  };
});
// --- AYUDANTES PARA EL MOCK (Para comparar fechas) ---
const parseTransferDate = (dateStr: string) => {
  if (!dateStr) return 0;
  const parts = dateStr.split('/');
  return parseInt(`${parts[2]}${parts[1]}${parts[0]}`);
};

const parseInputDate = (dateStr: string) => {
  if (!dateStr) return 0;
  const parts = dateStr.split('-');
  return parseInt(`${parts[0]}${parts[1]}${parts[2]}`);
};

// --- THUNK (SIMULACIÓN DE API CON PAGINACIÓN Y FECHAS) ---
export const fetchTransfers = createAsyncThunk(
  'transfers/fetchTransfers', 
  async (params: FetchTransfersParams, { rejectWithValue }) => {
    try {
      return new Promise<{ data: Transfer[]; total: number; pages: number }>((resolve) => {
        setTimeout(() => {
          let filtrados = [...MOCK_DB];

          // 1. EL SERVIDOR FILTRA POR FECHAS (¡Lo que faltaba!)
          if (params.fechaDesde) {
            const desde = parseInputDate(params.fechaDesde);
            filtrados = filtrados.filter(t => parseTransferDate(t.fecha) >= desde);
          }
          if (params.fechaHasta) {
            const hasta = parseInputDate(params.fechaHasta);
            filtrados = filtrados.filter(t => parseTransferDate(t.fecha) <= hasta);
          }

          // 2. EL SERVIDOR FILTRA LO DEMÁS
          if (params.numero) filtrados = filtrados.filter(t => t.numero.includes(params.numero!));
          if (params.tipo && params.tipo !== 'TODOS') filtrados = filtrados.filter(t => t.tipo === params.tipo);
          if (params.estado && params.estado !== 'TODOS') filtrados = filtrados.filter(t => t.estado === params.estado);
          
          const totalItems = filtrados.length;
          const totalPages = Math.ceil(totalItems / params.limit);
          
          const paginatedData = filtrados.slice((params.page - 1) * params.limit, params.page * params.limit);

          resolve({
            data: paginatedData,
            total: totalItems,
            pages: totalPages
          });
        }, 600); 
      });

    } catch (error) {
      if (axios.isAxiosError(error)) return rejectWithValue(error.response?.data?.message || 'Error');
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
        // 2. GUARDAMOS LA DATA EXACTA QUE ENVIÓ EL SERVIDOR
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
export const selectTransfersTotalPages = (state: RootState) => state.techTransfers.totalPages; // Nuevo selector

export default transfersSlice.reducer;