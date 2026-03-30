import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { type RootState } from '../../app/store';
import api from '../../services/api';
import { ADMIN_ENDPOINTS } from '../../services/endpoints/admin';

export interface SystemUser {
  id: string;
  codigo: string;
  name: string;   
  email: string;
  role: 'admin' | 'servtecnico' | 'clientes';
  status: 'active' | 'inactive';
  idBranch?: string; 
  ubicacion?: string; 
  codigoCliente?: string;   // NUEVO
  codigoProveedor?: string; // NUEVO
}

export interface CreateUserPayload {
  userName: string;
  email: string;
  password?: string;
  userNameComplete: string;
  ubicacion: string;       
  codigoCliente: string;   
  codigoProveedor: string; 
  idBranch: string;        
  rol: 'servtecnico'; 
}

export interface UpdateUserPayload {
  emailActual: string;
  nuevoEmail: string;
  nuevoUserName: string;
  userNameComplete: string;
  ubicacion: string;       
  codigoCliente: string;   
  codigoProveedor: string; 
  idBranch: string;        
}

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

// NUEVO: INTERFAZ GENÉRICA PARA CLIENTES Y PROVEEDORES
export interface SapPartner {
  codigo: string; // Ajusta si tu JSON devuelve "id" o "cardCode"
  nombre: string; // Ajusta si tu JSON devuelve "cardName"
}

interface UsersState {
  list: SystemUser[];
  bodegas: ApiBodega[];       
  ubicaciones: ApiUbicacion[];
  clientes: SapPartner[];       // NUEVO
  proveedores: SapPartner[];    // NUEVO
  isLoading: boolean;
  isSapLoading: boolean;      
  isSearchingPartners: boolean; // NUEVO
  error: string | null;
}

export interface ApiUserResponse {
  id: string;
  userName: string;
  email: string;
  roles: string[];
  userNameComplete: string;
  mobileUser: boolean;
  deviceId: string | null;
  ubicacion: string | null;
  codigoCliente: string | null;
  codigoProveedor: string | null;
  keyNeverExpires: boolean;
  modifyKey: boolean;
  idDepartment: string | null;
  idBranch: string | null;
}

const initialState: UsersState = {
  list: [],
  bodegas: [],
  ubicaciones: [],
  clientes: [],
  proveedores: [],
  isLoading: false,
  isSapLoading: false,
  isSearchingPartners: false,
  error: null,
};

const parseDotNetError = (error: unknown, defaultMessage: string) => {
  if (axios.isAxiosError(error)) {
    const errorData = error.response?.data;
    if (Array.isArray(errorData) && errorData.length > 0) return errorData[0].description; 
    return errorData?.message || defaultMessage;
  }
  return 'Error desconocido';
};

export const fetchUsers = createAsyncThunk('users/fetchUsers', async (_, { rejectWithValue }) => {
  try {
    const response = await api.get<ApiUserResponse[]>(ADMIN_ENDPOINTS.GET_USERS);
    const dataTransformada: SystemUser[] = response.data.map((u) => ({
      id: u.id,
      codigo: u.userName,
      name: u.userNameComplete,
      email: u.email,
      role: (u.roles && u.roles.length > 0 ? u.roles[0] : 'servtecnico') as SystemUser['role'],
      status: 'active',
      idBranch: u.idBranch || undefined,   
      ubicacion: u.ubicacion || undefined, 
      codigoCliente: u.codigoCliente || undefined,
      codigoProveedor: u.codigoProveedor || undefined,
    }));
    return dataTransformada;
  } catch (error) {
    if (axios.isAxiosError(error)) return rejectWithValue(error.response?.data?.message || 'Error al obtener usuarios');
    return rejectWithValue('Error desconocido');
  }
});

export const createUser = createAsyncThunk('users/createUser', async (userData: CreateUserPayload, { dispatch, rejectWithValue }) => {
  try {
    await api.post(ADMIN_ENDPOINTS.CREATE_USER, userData);
    dispatch(fetchUsers());
    return true;
  } catch (error) {
    return rejectWithValue(parseDotNetError(error, 'Error al crear usuario'));
  }
});

export const updateUser = createAsyncThunk('users/updateUser', async (userData: UpdateUserPayload, { dispatch, rejectWithValue }) => {
  try {
    await api.patch(ADMIN_ENDPOINTS.UPDATE_USER, userData);
    dispatch(fetchUsers());
    return true;
  } catch (error) {
    return rejectWithValue(parseDotNetError(error, 'Error al actualizar usuario'));
  }
});

export const resetUserPassword = createAsyncThunk('users/resetPassword', async (payload: { emailUsuario: string, passwordNueva: string }, { rejectWithValue }) => {
  try {
    await api.post(ADMIN_ENDPOINTS.RESET_PASSWORD, payload);
    return true;
  } catch (error) {
    return rejectWithValue(parseDotNetError(error, 'Error al cambiar contraseña'));
  }
});

export const makeAdmin = createAsyncThunk('users/makeAdmin', async (email: string, { dispatch, rejectWithValue }) => {
  try {
    await api.post(ADMIN_ENDPOINTS.MAKE_ADMIN, { email });
    dispatch(fetchUsers()); 
    return true;
  } catch (error) {
    return rejectWithValue(parseDotNetError(error, 'Error al otorgar permisos de administrador'));
  }
});

export const removeAdmin = createAsyncThunk('users/removeAdmin', async (email: string, { dispatch, rejectWithValue }) => {
  try {
    await api.post(ADMIN_ENDPOINTS.REMOVE_ADMIN, { email });
    dispatch(fetchUsers()); 
    return true;
  } catch (error) {
    return rejectWithValue(parseDotNetError(error, 'Error al quitar permisos de administrador'));
  }
});

export const fetchBodegas = createAsyncThunk('users/fetchBodegas', async (_, { rejectWithValue }) => {
  try {
    const response = await api.get<ApiBodega[]>(ADMIN_ENDPOINTS.GET_SAP_BODEGAS);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) return rejectWithValue(error.response?.data?.message || 'Error al obtener bodegas SAP');
    return rejectWithValue('Error desconocido');
  }
});

export const fetchUbicaciones = createAsyncThunk('users/fetchUbicaciones', async (whsCode: string, { rejectWithValue }) => {
  try {
    const response = await api.get<ApiUbicacion[]>(ADMIN_ENDPOINTS.GET_SAP_UBICACIONES(whsCode));
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) return rejectWithValue(error.response?.data?.message || 'Error al obtener ubicaciones SAP');
    return rejectWithValue('Error desconocido');
  }
});

// --- NUEVOS THUNKS: BUSCADOR DE CLIENTES Y PROVEEDORES ---
export const searchClientes = createAsyncThunk('users/searchClientes', async (query: string, { rejectWithValue }) => {
  try {
    let url = `${ADMIN_ENDPOINTS.GET_SAP_CLIENTES}?top=20&skip=0`;
    if (query) {
      // Si el query parece un número de código, podrías usar SEARCH_SAP_CLIENTES_ID, pero por simplicidad usaremos pornombre para todo
      url = `${ADMIN_ENDPOINTS.SEARCH_SAP_CLIENTES_NOMBRE}?nombre=${query}&top=20&skip=0`;
    }
    const response = await api.get<SapPartner[]>(url);
    return response.data;
  } catch (error) {
    return rejectWithValue('Error al buscar clientes '+ error);
  }
});

export const searchProveedores = createAsyncThunk('users/searchProveedores', async (query: string, { rejectWithValue }) => {
  try {
    let url = `${ADMIN_ENDPOINTS.GET_SAP_PROVEEDORES}?top=20&skip=0`;
    if (query) {
      url = `${ADMIN_ENDPOINTS.SEARCH_SAP_PROVEEDORES_NOMBRE}?nombre=${query}&top=20&skip=0`;
    }
    const response = await api.get<SapPartner[]>(url);
    return response.data;
  } catch (error) {
    return rejectWithValue('Error al buscar proveedores '+ error );
  }
});

export const usersSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {
    clearUbicaciones: (state) => { state.ubicaciones = []; }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUsers.pending, (state) => { state.isLoading = true; })
      .addCase(fetchUsers.fulfilled, (state, action) => { state.isLoading = false; state.list = action.payload; })
      .addCase(fetchUsers.rejected, (state, action) => { state.isLoading = false; state.error = action.payload as string; })
      .addCase(fetchBodegas.pending, (state) => { state.isSapLoading = true; })
      .addCase(fetchBodegas.fulfilled, (state, action) => { state.isSapLoading = false; state.bodegas = action.payload; })
      .addCase(fetchBodegas.rejected, (state) => { state.isSapLoading = false; })
      .addCase(fetchUbicaciones.pending, (state) => { state.isSapLoading = true; })
      .addCase(fetchUbicaciones.fulfilled, (state, action) => { state.isSapLoading = false; state.ubicaciones = action.payload; })
      .addCase(fetchUbicaciones.rejected, (state) => { state.isSapLoading = false; })
      
      // Manejo de Clientes
      .addCase(searchClientes.pending, (state) => { state.isSearchingPartners = true; })
      .addCase(searchClientes.fulfilled, (state, action) => { state.isSearchingPartners = false; state.clientes = action.payload; })
      .addCase(searchClientes.rejected, (state) => { state.isSearchingPartners = false; })
      // Manejo de Proveedores
      .addCase(searchProveedores.pending, (state) => { state.isSearchingPartners = true; })
      .addCase(searchProveedores.fulfilled, (state, action) => { state.isSearchingPartners = false; state.proveedores = action.payload; })
      .addCase(searchProveedores.rejected, (state) => { state.isSearchingPartners = false; });
  },
});

export const { clearUbicaciones } = usersSlice.actions;

export const selectAllUsers = (state: RootState) => state.adminUsers.list;
export const selectUsersLoading = (state: RootState) => state.adminUsers.isLoading;
export const selectBodegas = (state: RootState) => state.adminUsers.bodegas;
export const selectUbicaciones = (state: RootState) => state.adminUsers.ubicaciones;
export const selectSapLoading = (state: RootState) => state.adminUsers.isSapLoading;
export const selectClientes = (state: RootState) => state.adminUsers.clientes;
export const selectProveedores = (state: RootState) => state.adminUsers.proveedores;
export const selectSearchingPartners = (state: RootState) => state.adminUsers.isSearchingPartners;

export default usersSlice.reducer;