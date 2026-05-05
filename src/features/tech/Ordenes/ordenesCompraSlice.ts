import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import { type RootState } from '../../../app/store';
import api from '../../../services/api';
import { TECH_ENDPOINTS } from '../../../services/endpoints/tech';

export interface OrdenCompraDetalle {
  id: number;
  ordenCompraId: number;
  item: string;
  descripcion: string;
  cantidad: number;
  precio: number;
  bodega: string;
  usuCrea?: string;
  usuFechaCrea?: string;
  usuModifica?: string | null;
  usuFechaModifica?: string | null;
}

export interface OrdenCompra {
  id: number;
  nroInterno: number | null;
  nroDocumento: number | null;
  proveedorId: string;
  fecha: string;
  fechaVencimiento: string;
  comentarios: string;
  series: number;
  estado: string;
  ubicacionServicioTecnico: string;
  nroServicio: string;
  usuCrea: string | null;
  usuFechaCrea: string;
  usuModifica: string | null;
  usuFechaModifica: string | null;
  detalles: OrdenCompraDetalle[];
}

export interface ProveedorSAP {
  cardCode: string;
  cardName: string;
}

interface OrdenesCompraState {
  list: OrdenCompra[];
  currentOrder: OrdenCompra | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
}

const initialState: OrdenesCompraState = {
  list: [],
  currentOrder: null,
  isLoading: false,
  isSaving: false,
  error: null,
};

interface FetchOCParams {
  pagina: number;
  recordsPorPagina: number;
  fechaDesde?: string;
  fechaHasta?: string;
  proveedorId?: string;
  estado?: string;
  nroServicio?: string;
}

export const fetchOrdenesCompra = createAsyncThunk<
  OrdenCompra[],
  FetchOCParams,
  { rejectValue: string }
>(
  'ordenesCompra/fetchList',
  async (params, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('Pagina', String(params.pagina));
      queryParams.append('RecordsPorPagina', String(params.recordsPorPagina));

      if (params.fechaDesde) queryParams.append('FechaDesde', params.fechaDesde);
      if (params.fechaHasta) queryParams.append('FechaHasta', params.fechaHasta);
      if (params.proveedorId) queryParams.append('ProveedorId', params.proveedorId);
      if (params.estado && params.estado !== 'TODOS') queryParams.append('Estado', params.estado);
      if (params.nroServicio) queryParams.append('NroServicio', params.nroServicio);

      const response = await api.get<OrdenCompra[]>(`${TECH_ENDPOINTS.GET_ORDENES_COMPRA}?${queryParams.toString()}`);
      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) return rejectWithValue(error.response?.data?.message || 'Error al cargar las órdenes de compra');
      return rejectWithValue('Error desconocido');
    }
  }
);

export const fetchOrdenCompraById = createAsyncThunk<
  OrdenCompra,
  number,
  { rejectValue: string }
>(
  'ordenesCompra/fetchById',
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.get<OrdenCompra>(TECH_ENDPOINTS.GET_ORDEN_COMPRA_BY_ID(id));
      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) return rejectWithValue(error.response?.data?.message || 'Error al cargar la orden de compra');
      return rejectWithValue('Error desconocido');
    }
  }
);

export const updateOrdenCompra = createAsyncThunk<
  OrdenCompra,
  { id: number; data: Partial<OrdenCompra> },
  { rejectValue: string }
>(
  'ordenesCompra/update',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await api.put<OrdenCompra>(TECH_ENDPOINTS.PUT_ORDEN_COMPRA(id), data);
      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) return rejectWithValue(error.response?.data?.message || 'Error al actualizar la orden');
      return rejectWithValue('Error desconocido');
    }
  }
);

export const autorizarOrdenCompra = createAsyncThunk<
  number,
  number,
  { rejectValue: string }
>(
  'ordenesCompra/autorizar',
  async (id, { rejectWithValue }) => {
    try {
      await api.patch(TECH_ENDPOINTS.PATCH_ORDEN_COMPRA_ESTADO(id), { estado: 'A' });
      return id;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) return rejectWithValue(error.response?.data?.message || 'Error al autorizar la orden');
      return rejectWithValue('Error desconocido');
    }
  }
);

export const ordenesCompraSlice = createSlice({
  name: 'ordenesCompra',
  initialState,
  reducers: {
    clearCurrentOrder: (state) => {
      state.currentOrder = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchOrdenesCompra.pending, (state) => { state.isLoading = true; state.error = null; })
      .addCase(fetchOrdenesCompra.fulfilled, (state, action: PayloadAction<OrdenCompra[]>) => {
        state.isLoading = false;
        state.list = action.payload;
      })
      .addCase(fetchOrdenesCompra.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || 'Error';
      })
      .addCase(fetchOrdenCompraById.pending, (state) => { state.isLoading = true; state.error = null; })
      .addCase(fetchOrdenCompraById.fulfilled, (state, action: PayloadAction<OrdenCompra>) => {
        state.isLoading = false;
        state.currentOrder = action.payload;
      })
      .addCase(fetchOrdenCompraById.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || 'Error';
      })
      .addCase(updateOrdenCompra.pending, (state) => { state.isSaving = true; state.error = null; })
      .addCase(updateOrdenCompra.fulfilled, (state, action: PayloadAction<OrdenCompra>) => {
        state.isSaving = false;
        state.currentOrder = action.payload;
      })
      .addCase(updateOrdenCompra.rejected, (state, action) => {
        state.isSaving = false;
        state.error = action.payload || 'Error';
      })
      .addCase(autorizarOrdenCompra.pending, (state) => { state.isSaving = true; state.error = null; })
      .addCase(autorizarOrdenCompra.fulfilled, (state, action: PayloadAction<number>) => {
        state.isSaving = false;
        if (state.currentOrder && state.currentOrder.id === action.payload) {
          state.currentOrder.estado = 'A';
        }
      })
      .addCase(autorizarOrdenCompra.rejected, (state, action) => {
        state.isSaving = false;
        state.error = action.payload || 'Error';
      });
  },
});

export const { clearCurrentOrder } = ordenesCompraSlice.actions;


export const selectAllOrdenesCompra = (state: RootState) => state.techOrdenes.list;
export const selectCurrentOrdenCompra = (state: RootState) => state.techOrdenes.currentOrder;
export const selectOrdenesCompraLoading = (state: RootState) => state.techOrdenes.isLoading;
export const selectOrdenesCompraSaving = (state: RootState) => state.techOrdenes.isSaving;

export default ordenesCompraSlice.reducer;
