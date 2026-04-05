import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { type RootState } from '../../../app/store';
import api from '../../../services/api';
import { TECH_ENDPOINTS } from '../../../services/endpoints/tech';

// --- INTERFACES DE CABECERA Y DETALLES (SQL) ---
export interface ApiTransferDetailItem {
  id?: number; 
  item: string;
  descripcion: string;
  cantidad: number;
  cantidadRecibida: number;
}

export interface ApiTransferDetailResponse {
  id: number;
  nroInterno: number | null;
  nroDocumento: number | null;
  bodegaDesde: string;
  ubicacionDesde: string;
  bodegaHasta: string;
  ubicacionHasta: string;
  fecha: string;
  nroServicio: string | null;
  estado: string;
  tipo: string;
  details: ApiTransferDetailItem[];
}

export interface TransferItem {
  id: string; 
  originalId?: number; 
  itemCode: string;
  descripcion: string;
  cantidadPedida: number;
  cantidadRecibida: number | string; 
  isAccepted: boolean; 
}

// --- INTERFACES PARA SAP (BODEGAS, UBICACIONES E ÍTEMS) ---
export interface ApiBodega {
  whsCode: string;
  whsName: string;
}

export interface ApiUbicacion {
  absEntry: number;
  binCode: string;
  descripcion: string;
  whsCode: string;
}

export interface ApiSapItem {
  itemCode: string;
  itemName: string;
  itemsGroupCode: number;
  whsCode: string;
  binAbs: number;
  binCode: string;
  onHandQty: number;
}

export interface ApiSapItemsPaginatedResponse {
  top: number;
  skip: number;
  count: number;
  items: ApiSapItem[];
}

export interface SapItemResponse {
  itemCode: string;
  itemName: string;
  onHandQty: number;
}

// --- ESTADO DE REDUX ---
export interface ITransferItemsState {
  currentHeader: ApiTransferDetailResponse | null; 
  currentItems: TransferItem[];
  bodegas: ApiBodega[];
  ubicaciones: ApiUbicacion[];
  sapItems: SapItemResponse[];
  isLoading: boolean;
  isSubmitting: boolean;
  isSearchingItems: boolean;
  error: string | null;
}

const initialState: ITransferItemsState = {
  currentHeader: null,
  currentItems: [],
  bodegas: [],
  ubicaciones: [],
  sapItems: [],
  isLoading: false,
  isSubmitting: false,
  isSearchingItems: false,
  error: null,
};

// --- HELPER DE ERRORES ---
const parseDotNetError = (error: unknown, defaultMessage: string) => {
  if (axios.isAxiosError(error) && error.response) {
    const data = error.response.data;
    if (data && data.detail) {
      const detailMsg = data.detail.toString();
      if (detailMsg.includes('Ya existe una transferencia SAP')) {
        return 'La transferencia ya se registró en SAP previamente.';
      }
      return detailMsg;
    }
    if (data && data.message) return data.message;
  }
  if (axios.isAxiosError(error) && !error.response) {
    return 'Error de red. Verifique su conexión al servidor.';
  }
  return defaultMessage;
};

// --- THUNKS EXISTENTES (SQL Y SAP) ---
export const fetchTransferItems = createAsyncThunk('transferItems/fetchItems', async (transferId: string, { rejectWithValue }) => {
  try {
    const endpoint = transferId.startsWith('0-') 
      ? `/transferencias/0?docEntry=${transferId.split('-')[1]}` 
      : `/transferencias/${transferId}`;
    const response = await api.get<ApiTransferDetailResponse>(endpoint);
    return response.data;
  } catch (error) {
    return rejectWithValue(parseDotNetError(error, 'Error al recuperar los ítems'));
  }
});

export const saveTransfer = createAsyncThunk('transferItems/saveTransfer', 
  async (payload: { header: ApiTransferDetailResponse, items: TransferItem[], estadoForce?: string }, { rejectWithValue }) => {
    try {
      const { header, items, estadoForce } = payload;
      
      const mappedDetails = items.map((i) => {
        const detail: ApiTransferDetailItem = {
          item: i.itemCode,
          descripcion: i.descripcion,
          cantidad: i.cantidadPedida,
          cantidadRecibida: typeof i.cantidadRecibida === 'string' ? (parseInt(i.cantidadRecibida) || 0) : i.cantidadRecibida
        };
        if (header.id !== 0 && i.originalId) detail.id = i.originalId;
        return detail;
      });

      const basePayload: Record<string, unknown> = {
        bodegaDesde: header.bodegaDesde,
        ubicacionDesde: header.ubicacionDesde,
        bodegaHasta: header.bodegaHasta,
        ubicacionHasta: header.ubicacionHasta,
        fecha: header.fecha, 
        estado: estadoForce || 'P', 
        tipo: header.tipo,
        details: mappedDetails
      };

      if (header.nroServicio) basePayload.nroServicio = header.nroServicio;

      if (header.id === 0) {
        const postPayload = {
          ...basePayload,
          nroInterno: header.nroInterno || 0,
          nroDocumento: header.nroDocumento || 0,
        };
        const response = await api.post(TECH_ENDPOINTS.POST_TRANSFER, postPayload);
        return response.data?.id || response.data; 
      } else {
        const putPayload = { ...basePayload, id: header.id };
        await api.put(TECH_ENDPOINTS.PUT_TRANSFER(header.id), putPayload);
        return header.id;
      }
    } catch (error) {
      return rejectWithValue(parseDotNetError(error, 'Error al guardar la transferencia'));
    }
  }
);

export const authorizeSapTransfer = createAsyncThunk('transferItems/authorizeSapTransfer', 
  async (payload: { header: ApiTransferDetailResponse, items: TransferItem[], comentarios: string, estadoForce?: string }, { rejectWithValue }) => {
    try {
      const { header, items, comentarios, estadoForce } = payload;
      
      const detallesSap = items.map((i) => ({
        itemCode: i.itemCode,
        quantity: typeof i.cantidadRecibida === 'string' ? (parseInt(i.cantidadRecibida) || 0) : i.cantidadRecibida
      }));

      const sapPayload: Record<string, unknown> = {
        id: header.id, // <-- NUEVO: Enviamos el ID de la base de datos SQL
        nroInterno: header.nroInterno || 0,
        nroDocumento: header.nroDocumento || 0, 
        fecha: new Date().toISOString(), 
        bodegaDesde: header.bodegaDesde,
        ubicacionDesde: header.ubicacionDesde,
        bodegaHasta: header.bodegaHasta,
        ubicacionHasta: header.ubicacionHasta,
        estado: estadoForce || 'A', 
        comentarios: comentarios || '', 
        tipo:'TRF',
        detalles: detallesSap
      };

      if (header.nroServicio) sapPayload.nroServicio = header.nroServicio;

      await api.post(TECH_ENDPOINTS.POST_SAP_TRANSFER, sapPayload);
      return true;
    } catch (error) {
      return rejectWithValue(parseDotNetError(error, 'Error al autorizar en SAP'));
    }
  }
);

// --- NUEVOS THUNKS PARA LISTAS Y BUSCADORES DE CREACIÓN ---
export const fetchTechBodegas = createAsyncThunk('transferItems/fetchBodegas', async (_, { rejectWithValue }) => {
  try {
    const response = await api.get<ApiBodega[]>(TECH_ENDPOINTS.GET_SAP_BODEGAS);
    return response.data;
  } catch (error) {
    return rejectWithValue(parseDotNetError(error, 'Error al obtener bodegas'));
  }
});

export const fetchTechUbicaciones = createAsyncThunk('transferItems/fetchUbicaciones', async (whsCode: string, { rejectWithValue }) => {
  try {
    const response = await api.get<ApiUbicacion[]>(TECH_ENDPOINTS.GET_SAP_UBICACIONES(whsCode));
    return response.data;
  } catch (error) {
    return rejectWithValue(parseDotNetError(error, 'Error al obtener ubicaciones'));
  }
});

// Búsqueda concurrente (Nombre e ID) 100% tipada
export const searchSapItems = createAsyncThunk('transferItems/searchSapItems', 
  async ({ query, whsCode, binLocation }: { query: string, whsCode: string, binLocation: string }, { rejectWithValue }) => {
    try {
      const baseParams = `?top=20&skip=0&whsCode=${whsCode}&binLocation=${binLocation}`;

      if (!query) {
        const res = await api.get<ApiSapItemsPaginatedResponse>(`${TECH_ENDPOINTS.GET_SAP_ITEMS}${baseParams}`);
        return (res.data.items || []).map(item => ({ itemCode: item.itemCode, itemName: item.itemName, onHandQty: item.onHandQty }));
      }

      const queryEncoded = encodeURIComponent(query);
      
      const [nameResult, idResult] = await Promise.allSettled([
        api.get<ApiSapItemsPaginatedResponse>(`${TECH_ENDPOINTS.SEARCH_SAP_ITEMS_NOMBRE}${baseParams}&nombre=${queryEncoded}`),
        api.get<ApiSapItemsPaginatedResponse | ApiSapItem>(`${TECH_ENDPOINTS.SEARCH_SAP_ITEMS_ID(queryEncoded)}${baseParams}`)
      ]);

      let resultados: SapItemResponse[] = [];

      // Resultados por nombre
      if (nameResult.status === 'fulfilled' && nameResult.value.data.items) {
        resultados = nameResult.value.data.items.map(item => ({ 
          itemCode: item.itemCode, itemName: item.itemName, onHandQty: item.onHandQty 
        }));
      }

      // Resultados por ID (TYPE GUARD SEGURO)
      if (idResult.status === 'fulfilled' && idResult.value.data) {
        const dataId = idResult.value.data;
        const item: ApiSapItem | null = 'items' in dataId 
          ? (Array.isArray(dataId.items) ? dataId.items[0] : null) 
          : dataId;
        
        if (item && item.itemCode) {
          const existe = resultados.some(r => r.itemCode === item.itemCode);
          if (!existe) resultados.unshift({ itemCode: item.itemCode, itemName: item.itemName, onHandQty: item.onHandQty });
        }
      }

      return resultados;
    } catch (error) {
      return rejectWithValue(parseDotNetError(error, 'Error al buscar ítems en SAP'));
    }
  }
);

export const transferItemsSlice = createSlice({
  name: 'transferItems',
  initialState,
  reducers: {
    clearItems: (state) => {
      state.currentHeader = null;
      state.currentItems = [];
      state.sapItems = [];
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // GET Transfer Items
      .addCase(fetchTransferItems.pending, (state) => { state.isLoading = true; state.error = null; })
      .addCase(fetchTransferItems.fulfilled, (state, action) => { 
        state.isLoading = false; 
        state.currentHeader = action.payload; 
        state.currentItems = action.payload.details.map((d: ApiTransferDetailItem) => ({
          id: d.id ? d.id.toString() : d.item, 
          originalId: d.id,
          itemCode: d.item,
          descripcion: d.descripcion,
          cantidadPedida: d.cantidad,
          cantidadRecibida: d.cantidadRecibida, 
          isAccepted: false
        }));
      })
      .addCase(fetchTransferItems.rejected, (state, action) => { state.isLoading = false; state.error = action.payload as string; })
      
      // SAVE (POST/PUT)
      .addCase(saveTransfer.pending, (state) => { state.isSubmitting = true; })
      .addCase(saveTransfer.fulfilled, (state) => { state.isSubmitting = false; })
      .addCase(saveTransfer.rejected, (state, action) => { state.isSubmitting = false; state.error = action.payload as string; })
      
      // AUTHORIZE (SAP)
      .addCase(authorizeSapTransfer.pending, (state) => { state.isSubmitting = true; })
      .addCase(authorizeSapTransfer.fulfilled, (state) => { state.isSubmitting = false; })
      .addCase(authorizeSapTransfer.rejected, (state, action) => { state.isSubmitting = false; state.error = action.payload as string; })

      // GET Bodegas
      .addCase(fetchTechBodegas.fulfilled, (state, action) => { state.bodegas = action.payload; })
      // GET Ubicaciones
      .addCase(fetchTechUbicaciones.fulfilled, (state, action) => { state.ubicaciones = action.payload; })

      // SEARCH Items
      .addCase(searchSapItems.pending, (state) => { state.isSearchingItems = true; })
      .addCase(searchSapItems.fulfilled, (state, action) => { state.isSearchingItems = false; state.sapItems = action.payload; })
      .addCase(searchSapItems.rejected, (state) => { state.isSearchingItems = false; });
  },
});

export const { clearItems } = transferItemsSlice.actions;

export const selectTransferHeader = (state: RootState) => (state.techTransferItems as ITransferItemsState).currentHeader;
export const selectTransferItems = (state: RootState) => (state.techTransferItems as ITransferItemsState).currentItems;
export const selectItemsLoading = (state: RootState) => (state.techTransferItems as ITransferItemsState).isLoading;
export const selectIsSubmitting = (state: RootState) => (state.techTransferItems as ITransferItemsState).isSubmitting;

export const selectTechBodegas = (state: RootState) => (state.techTransferItems as ITransferItemsState).bodegas;
export const selectTechUbicaciones = (state: RootState) => (state.techTransferItems as ITransferItemsState).ubicaciones;
export const selectSapItems = (state: RootState) => (state.techTransferItems as ITransferItemsState).sapItems;
export const selectSearchingItems = (state: RootState) => (state.techTransferItems as ITransferItemsState).isSearchingItems;

export default transferItemsSlice.reducer;