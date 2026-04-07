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
  nroTransferencia?: number | null;
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

// --- INTERFACES PARA SAP ---
export interface ApiBodega { whsCode: string; whsName: string; }
export interface ApiUbicacion { absEntry: number; binCode: string; descripcion: string; whsCode: string; }
export interface ApiSapItem { itemCode: string; itemName: string; itemsGroupCode: number; whsCode: string; binAbs: number; binCode: string; onHandQty: number; }
export interface ApiSapItemsPaginatedResponse { top: number; skip: number; count: number; items: ApiSapItem[]; }
export interface SapItemResponse { itemCode: string; itemName: string; onHandQty: number; }

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

// --- HELPERS ---
const parseDotNetError = (error: unknown, defaultMessage: string) => {
  if (axios.isAxiosError(error) && error.response) {
    const data = error.response.data;
    if (data && data.detail) {
      const detailMsg = data.detail.toString();
      if (detailMsg.includes('Ya existe una transferencia SAP')) return 'La transferencia ya se registró en SAP previamente.';
      return detailMsg;
    }
    if (data && data.message) return data.message;
  }
  if (axios.isAxiosError(error) && !error.response) return 'Error de red. Verifique su conexión al servidor.';
  return defaultMessage;
};

// Obtenemos la hora local exacta sin que JavaScript la adelante por el UTC
const getLocalIsoTime = () => {
  const tzoffset = (new Date()).getTimezoneOffset() * 60000;
  return new Date(Date.now() - tzoffset).toISOString().slice(0, -1);
};

export const fetchTransferItems = createAsyncThunk(
  'transferItems/fetchItems', 
  async (params: { transferId: string; bodega: string; ubicacion: string }, { rejectWithValue }) => {
    try {
      const { transferId, bodega, ubicacion } = params;
      const endpoint = TECH_ENDPOINTS.GET_TRANSFER_ITEMS(transferId, bodega, ubicacion);
      const response = await api.get<ApiTransferDetailResponse>(endpoint);
      return response.data;
    } catch (error) {
      return rejectWithValue(parseDotNetError(error, 'Error al recuperar los ítems'));
    }
  }
);

// --- LÓGICA DE GUARDADO EN SQL (POST VS PUT DINÁMICO) ---
export const saveTransfer = createAsyncThunk('transferItems/saveTransfer', 
  async (payload: { header: ApiTransferDetailResponse, items: TransferItem[], estadoForce?: string, isValidationCreate?: boolean }, { rejectWithValue }) => {
    try {
      const { header, items, estadoForce, isValidationCreate } = payload;
      
      const mappedDetails = items.map((i) => {
        const detail: ApiTransferDetailItem = {
          item: i.itemCode,
          descripcion: i.descripcion,
          cantidad: i.cantidadPedida,
          cantidadRecibida: typeof i.cantidadRecibida === 'string' ? (parseInt(i.cantidadRecibida) || 0) : i.cantidadRecibida
        };
        if (!isValidationCreate && header.id !== 0 && i.originalId) detail.id = i.originalId;
        return detail;
      });

      // 🚨 REGLA ESTRICTA: Por defecto SIEMPRE será 'P', a menos que desde la UI se mande explicitamente 'A' (solo ocurre al autorizar)
      const estadoDefinitivo = estadoForce ?? 'P';

      const basePayload: Record<string, unknown> = {
        bodegaDesde: header.bodegaDesde,
        ubicacionDesde: header.ubicacionDesde,
        bodegaHasta: header.bodegaHasta,
        ubicacionHasta: header.ubicacionHasta,
        fecha: getLocalIsoTime(), 
        nroServicio: header.nroServicio || null, 
        estado: estadoDefinitivo, 
        tipo: header.tipo,
        details: mappedDetails,
        nroTransferencia: isValidationCreate ? header.id : (header.nroTransferencia || null)
      };

      const isPostMode = isValidationCreate || header.id === 0;

      if (isPostMode) {
        const postPayload = {
          ...basePayload,
          nroInterno: isValidationCreate ? null : (header.nroInterno || null),
          nroDocumento: isValidationCreate ? null : (header.nroDocumento || null),
        };
        const response = await api.post(TECH_ENDPOINTS.POST_TRANSFER, postPayload);
        return response.data?.id || response.data; 
      } else {
        const putPayload = { ...basePayload, id: header.id };
        await api.put(TECH_ENDPOINTS.PUT_TRANSFER(header.id), putPayload);
        return header.id;
      }
    } catch (error) {
      return rejectWithValue(parseDotNetError(error, 'Error al guardar la transferencia en SQL'));
    }
  }
);

// --- LÓGICA DE AUTORIZACIÓN A SAP ---
export const authorizeSapTransfer = createAsyncThunk('transferItems/authorizeSapTransfer', 
  async (payload: { header: ApiTransferDetailResponse, items: TransferItem[], comentarios: string, estadoForce?: string, isValidationCreate?: boolean }, { rejectWithValue }) => {
    try {
      const { header, items, comentarios, estadoForce, isValidationCreate } = payload;
      
      const detallesSap = items.map((i) => ({
        itemCode: i.itemCode,
        quantity: typeof i.cantidadRecibida === 'string' ? (parseInt(i.cantidadRecibida) || 0) : i.cantidadRecibida
      }));

      // 🚨 REGLA ESTRICTA: A SAP SIEMPRE viaja como 'A', a menos que explícitamente se force otra cosa.
      const estadoDefinitivo = estadoForce ?? 'A';

      const sapPayload: Record<string, unknown> = {
        id: isValidationCreate ? 0 : header.id, 
        tipo: 'TRF',
        nroTransferencia: isValidationCreate ? header.id : (header.nroTransferencia || header.nroDocumento || null), 
        nroInterno: isValidationCreate ? 0 : (header.nroInterno || 0),
        nroDocumento: isValidationCreate ? 0 : (header.nroDocumento || 0), 
        fecha: getLocalIsoTime(),
        bodegaDesde: header.bodegaDesde,
        ubicacionDesde: header.ubicacionDesde,
        bodegaHasta: header.bodegaHasta,
        ubicacionHasta: header.ubicacionHasta,
        estado: estadoDefinitivo, 
        comentarios: comentarios || '', 
        detalles: detallesSap
      };

      await api.post(TECH_ENDPOINTS.POST_SAP_TRANSFER, sapPayload);
      return true;
    } catch (error) {
      return rejectWithValue(parseDotNetError(error, 'Error al autorizar en SAP'));
    }
  }
);

// --- BÚSQUEDAS ---
export const fetchTechBodegas = createAsyncThunk('transferItems/fetchBodegas', async (_, { rejectWithValue }) => {
  try {
    const response = await api.get<ApiBodega[]>(TECH_ENDPOINTS.GET_SAP_BODEGAS);
    return response.data;
  } catch (error) { return rejectWithValue(parseDotNetError(error, 'Error al obtener bodegas')); }
});

export const fetchTechUbicaciones = createAsyncThunk('transferItems/fetchUbicaciones', async (whsCode: string, { rejectWithValue }) => {
  try {
    const response = await api.get<ApiUbicacion[]>(TECH_ENDPOINTS.GET_SAP_UBICACIONES(whsCode));
    return response.data;
  } catch (error) { return rejectWithValue(parseDotNetError(error, 'Error al obtener ubicaciones')); }
});

export const searchSapItems = createAsyncThunk('transferItems/searchSapItems', 
  async ({ query, whsCode, binLocation }: { query: string, whsCode: string, binLocation: string }, { rejectWithValue }) => {
    try {
      const baseParams = `?top=20&skip=0&whsCode=${whsCode}&binLocation=${binLocation}`;

      // 🛠️ EL EXTRACTOR: Atrapa el arreglo venga como venga envuelto desde el backend
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const extractData = (rawData: any): any[] => {
        if (!rawData) return [];
        if (Array.isArray(rawData)) return rawData;
        if (Array.isArray(rawData.items)) return rawData.items;
        // Si el backend devolvió un solo objeto en vez de un arreglo
        if (rawData.itemCode) return [rawData];
        return [];
      };

      if (!query) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res = await api.get<any>(`${TECH_ENDPOINTS.GET_SAP_REPUESTOS}${baseParams}`);
        const items = extractData(res.data);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return items.map((item: any) => ({ itemCode: item.itemCode, itemName: item.itemName, onHandQty: item.onHandQty || 0 }));
      }

      const queryEncoded = encodeURIComponent(query.toUpperCase());
      let resultados: SapItemResponse[] = [];

      // 1. PRIMERA CONSULTA: Siempre buscamos por Nombre primero
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const nameResult = await api.get<any>(`${TECH_ENDPOINTS.SEARCH_SAP_REPUESTOS_NOMBRE}${baseParams}&nombre=${queryEncoded}`);
        
        // Usamos el extractor mágico
        const nameItems = extractData(nameResult.data);
        
        if (nameItems.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          resultados = nameItems.map((item: any) => ({ 
            itemCode: item.itemCode, 
            itemName: item.itemName, 
            onHandQty: item.onHandQty || 0 
          }));
        }
      } catch (error) {
        console.warn("Búsqueda por nombre sin coincidencias o dio 404.");
      }

      // 2. SEGUNDA CONSULTA: Por ID (¡SOLO se ejecuta si el nombre de verdad no trajo nada!)
      if (resultados.length === 0) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const idResult = await api.get<any>(`${TECH_ENDPOINTS.SEARCH_SAP_REPUESTOS_ID(queryEncoded)}${baseParams}`);
          const idItems = extractData(idResult.data);
          
          if (idItems.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            resultados = idItems.map((item: any) => ({ 
              itemCode: item.itemCode, 
              itemName: item.itemName, 
              onHandQty: item.onHandQty || 0 
            }));
          }
        } catch (error) {
          // Falla silenciosa si da 404 porque el código no existía
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
      
      .addCase(saveTransfer.pending, (state) => { state.isSubmitting = true; })
      .addCase(saveTransfer.fulfilled, (state) => { state.isSubmitting = false; })
      .addCase(saveTransfer.rejected, (state, action) => { state.isSubmitting = false; state.error = action.payload as string; })
      
      .addCase(authorizeSapTransfer.pending, (state) => { state.isSubmitting = true; })
      .addCase(authorizeSapTransfer.fulfilled, (state) => { state.isSubmitting = false; })
      .addCase(authorizeSapTransfer.rejected, (state, action) => { state.isSubmitting = false; state.error = action.payload as string; })

      .addCase(fetchTechBodegas.fulfilled, (state, action) => { state.bodegas = action.payload; })
      .addCase(fetchTechUbicaciones.fulfilled, (state, action) => { state.ubicaciones = action.payload; })

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