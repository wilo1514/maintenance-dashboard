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

export interface CreateUserPayload {
  userName: string;
  email: string;
  password?: string;
  userNameComplete: string;
  rol: 'servtecnico'; 
}

export interface UpdateUserPayload {
  emailActual: string;
  nuevoEmail: string;
  nuevoUserName: string;
  userNameComplete: string;
}

interface UsersState {
  list: SystemUser[];
  isLoading: boolean;
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
  isLoading: false,
  error: null,
};

// --- FUNCIÓN HELPER PARA PARSEAR ERRORES DE .NET IDENTITY ---
// La centralizamos aquí para no repetir código en cada Thunk
const parseDotNetError = (error: unknown, defaultMessage: string) => {
  if (axios.isAxiosError(error)) {
    const errorData = error.response?.data;
    if (Array.isArray(errorData) && errorData.length > 0) {
      // Retornamos la descripción que manda C# (ej: "Passwords must have at least one uppercase...")
      return errorData[0].description; 
    }
    return errorData?.message || defaultMessage;
  }
  return 'Error desconocido';
};

// --- THUNKS ASÍNCRONOS REALES ---

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

// =====================================================================
// --- FUTURA INTEGRACIÓN CON SAP (Búsqueda de empleado por código) ---
// =====================================================================
/*
export const searchSapUser = createAsyncThunk('users/searchSapUser', async (codigo: string, { rejectWithValue }) => {
  try {
    // Cuando la API real de SAP esté conectada al Backend, usarás esto:
    // const response = await api.get(ADMIN_ENDPOINTS.SEARCH_SAP_USER(codigo));
    // return response.data; 
    
    // Mock temporal para pruebas front:
    return new Promise<{ name: string; email: string }>((resolve) => {
      setTimeout(() => resolve({ name: 'Usuario Encontrado SAP', email: 'correo.sap@umco.com' }), 800);
    });
  } catch (error) {
    if (axios.isAxiosError(error)) return rejectWithValue(error.response?.data?.message || 'Error al buscar en SAP');
    return rejectWithValue('Error desconocido');
  }
});
*/

// --- SLICE ---
export const usersSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(fetchUsers.pending, (state) => { state.isLoading = true; });
    builder.addCase(fetchUsers.fulfilled, (state, action) => {
      state.isLoading = false;
      state.list = action.payload;
    });
    builder.addCase(fetchUsers.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });
  },
});

export const selectAllUsers = (state: RootState) => state.adminUsers.list;
export const selectUsersLoading = (state: RootState) => state.adminUsers.isLoading;

export default usersSlice.reducer;