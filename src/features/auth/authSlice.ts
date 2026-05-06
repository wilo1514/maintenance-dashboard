import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { type RootState } from '../../app/store';
import api from '../../services/api';
import { AUTH_ENDPOINTS } from '../../services/endpoints/auth';
import { TECH_ENDPOINTS } from '../../services/endpoints/tech';

interface AuthResponse {
  token: string;
  expiracion: string;
  datosAdicionales: {
    sub: string;
    username: string;
    email: string;
    ubicacion: string;
    idbranch: string;
    codigocliente: string;
    codigoproveedor: string;
  };
  roles: string[];
}

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: string;
  ubicacion: string;
  idbranch: string;
  codigocliente?: string;
  codigoproveedor?: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  rawRoles: string[] | null;
  expiracion: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

const storedUser = localStorage.getItem('user');
const storedToken = localStorage.getItem('token');
const storedRoles = localStorage.getItem('roles');
const storedExpiracion = localStorage.getItem('expiracion');

const safeJSONParse = <T>(data: string | null): T | null => {
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch (error) {
    console.warn('Datos locales corruptos, ignorando...', error);
    return null;
  }
};

const initialState: AuthState = {
  user: safeJSONParse<AuthUser>(storedUser),
  token: storedToken || null,
  rawRoles: safeJSONParse<string[]>(storedRoles),
  expiracion: storedExpiracion || null,
  isAuthenticated: !!storedToken,
  isLoading: false,
  error: null,
};

const getApiErrorMessage = (data: unknown, fallback: string) => {
  if (!data) return fallback;
  if (typeof data === 'string') return data;
  if (typeof data === 'object') {
    const errorData = data as { message?: unknown; title?: unknown; error?: unknown };
    if (typeof errorData.message === 'string') return errorData.message;
    if (typeof errorData.title === 'string') return errorData.title;
    if (typeof errorData.error === 'string') return errorData.error;
  }
  return fallback;
};

export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async (credentials: { userName: string; password: string }, { rejectWithValue }) => {
    try {
      const response = await api.post<AuthResponse>(AUTH_ENDPOINTS.LOGIN, credentials);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return rejectWithValue(getApiErrorMessage(error.response?.data, 'Error de conexion con el servidor'));
      }
      if (error instanceof Error) return rejectWithValue(error.message);
      return rejectWithValue('Codigo o contrasena incorrectos');
    }
  }
);

export const changeUserPassword = createAsyncThunk(
  'auth/changePassword',
  async (payload: { emailUsuario: string; passwordActual: string; passwordNueva: string }, { rejectWithValue }) => {
    try {
      const response = await api.post(TECH_ENDPOINTS.CHANGE_PASSWORD, payload);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorData = error.response?.data;

        if (Array.isArray(errorData) && errorData.length > 0) {
          const errorCode = errorData[0].code;
          const errorDesc = errorData[0].description;

          if (errorCode === 'PasswordMismatch') {
            return rejectWithValue('La contrasena actual ingresada es incorrecta.');
          }
          return rejectWithValue(errorDesc);
        }
        return rejectWithValue(getApiErrorMessage(errorData, 'Error al cambiar la contrasena'));
      }
      return rejectWithValue('Error desconocido');
    }
  }
);

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      state.isAuthenticated = false;
      state.user = null;
      state.token = null;
      state.rawRoles = null;
      state.expiracion = null;
      state.error = null;

      localStorage.removeItem('user');
      localStorage.removeItem('token');
      localStorage.removeItem('roles');
      localStorage.removeItem('expiracion');
    },
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.token = action.payload.token;
        state.expiracion = action.payload.expiracion;
        state.rawRoles = action.payload.roles;

        const userData: AuthUser = {
          id: action.payload.datosAdicionales.sub,
          username: action.payload.datosAdicionales.username,
          email: action.payload.datosAdicionales.email,
          role: action.payload.roles[0] || 'clientes',
          ubicacion: action.payload.datosAdicionales.ubicacion,
          idbranch: action.payload.datosAdicionales.idbranch,
          codigocliente: action.payload.datosAdicionales.codigocliente,
          codigoproveedor: action.payload.datosAdicionales.codigoproveedor,
        };
        state.user = userData;

        localStorage.setItem('token', action.payload.token);
        localStorage.setItem('expiracion', action.payload.expiracion);
        localStorage.setItem('roles', JSON.stringify(action.payload.roles));
        localStorage.setItem('user', JSON.stringify(userData));
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { logout, clearError } = authSlice.actions;

export const selectIsAuthenticated = (state: RootState) => state.auth.isAuthenticated;
export const selectCurrentUser = (state: RootState) => state.auth.user;
export const selectAuthLoading = (state: RootState) => state.auth.isLoading;

export default authSlice.reducer;
