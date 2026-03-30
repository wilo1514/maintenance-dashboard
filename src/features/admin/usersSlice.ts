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
}

// NUEVO: INTERFAZ EXACTA SEGÚN TU JSON DE CREACIÓN
export interface CreateUserPayload {
  userName: string;
  email: string;
  password?: string;
  userNameComplete: string;
  ubicacion: string;       // Ej: 05-FT11
  codigoCliente: string;   // Ej: 05-FT11-C
  codigoProveedor: string; // Ej: 05-FT11-P
  idBranch: string;        // Ej: 05
  rol: 'servtecnico'; 
}

export interface UpdateUserPayload {
  emailActual: string;
  nuevoEmail: string;
  nuevoUserName: string;
  userNameComplete: string;
}

// NUEVO: INTERFACES PARA SAP
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

interface UsersState {
  list: SystemUser[];
  bodegas: ApiBodega[];       // Lista para el primer select
  ubicaciones: ApiUbicacion[];// Lista para el segundo select
  isLoading: boolean;
  isSapLoading: boolean;      // Loading separado para bodegas/ubicaciones
  error: string | null;
}

export interface ApiUserResponse {
  id: string;
  userName: string;
  email: string;
  roles: string[];
  userNameComplete: string;
}

const initialState: UsersState = {
  list: [],
  bodegas: [],
  ubicaciones: [],
  isLoading: false,
  isSapLoading: false,
  error: null,
};

const parseDotNetError = (error: unknown, defaultMessage: string) => {
  if (axios.isAxiosError(error)) {
    const errorData = error.response?.data;
    if (Array.isArray(errorData) && errorData.length > 0) {
      return errorData[0].description; 
    }
    return errorData?.message || defaultMessage;
  }
  return 'Error desconocido';
};

// --- THUNKS DE USUARIOS ---
export const fetchUsers = createAsyncThunk('users/fetchUsers', async (_, { rejectWithValue }) => {
  try {
    const response = await api.get<ApiUserResponse[]>(ADMIN_ENDPOINTS.GET_USERS);
    const dataTransformada: SystemUser[] = response.data.map((u) => ({
      id: u.id,
      codigo: u.userName,
      name: u.userNameComplete,
      email: u.email,
      role: (u.roles && u.roles.length > 0 ? u.roles[0] : 'servtecnico') as SystemUser['role'],
      status: 'active' 
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

// --- NUEVOS THUNKS PARA SAP BODEGAS Y UBICACIONES ---
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


export const usersSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {
    // Reducer para limpiar ubicaciones cuando el usuario cambie de bodega
    clearUbicaciones: (state) => {
      state.ubicaciones = [];
    }
  },
  extraReducers: (builder) => {
    builder
      // Users
      .addCase(fetchUsers.pending, (state) => { state.isLoading = true; })
      .addCase(fetchUsers.fulfilled, (state, action) => { state.isLoading = false; state.list = action.payload; })
      .addCase(fetchUsers.rejected, (state, action) => { state.isLoading = false; state.error = action.payload as string; })
      // Bodegas
      .addCase(fetchBodegas.pending, (state) => { state.isSapLoading = true; })
      .addCase(fetchBodegas.fulfilled, (state, action) => { state.isSapLoading = false; state.bodegas = action.payload; })
      .addCase(fetchBodegas.rejected, (state) => { state.isSapLoading = false; })
      // Ubicaciones
      .addCase(fetchUbicaciones.pending, (state) => { state.isSapLoading = true; })
      .addCase(fetchUbicaciones.fulfilled, (state, action) => { state.isSapLoading = false; state.ubicaciones = action.payload; })
      .addCase(fetchUbicaciones.rejected, (state) => { state.isSapLoading = false; });
  },
});

export const { clearUbicaciones } = usersSlice.actions;

export const selectAllUsers = (state: RootState) => state.adminUsers.list;
export const selectUsersLoading = (state: RootState) => state.adminUsers.isLoading;
export const selectBodegas = (state: RootState) => state.adminUsers.bodegas;
export const selectUbicaciones = (state: RootState) => state.adminUsers.ubicaciones;
export const selectSapLoading = (state: RootState) => state.adminUsers.isSapLoading;

export default usersSlice.reducer;