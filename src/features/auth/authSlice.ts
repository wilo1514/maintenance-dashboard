import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { type RootState } from '../../app/store';
import api from '../../services/api';
import { AUTH_ENDPOINTS } from '../../services/endpoints/auth';
import { TECH_ENDPOINTS } from '../../services/endpoints/tech';

// 1. INTERFAZ EXACTA DE LO QUE ENVÍA EL BACKEND EN C#
interface AuthResponse {
  token: string;
  expiracion: string;
  datosAdicionales: {
    sub: string;
    username: string;
    email: string;
  };
  roles: string[]; // ¡Ojo! El backend envía un arreglo, no un texto
}

// 2. INTERFAZ DE NUESTRO ESTADO EN REDUX
interface AuthState {
  user: {
    id: string;
    username: string;
    email: string;
    role: string; // Extraeremos el primer rol para que funcione con tu Sidebar
  } | null;
  token: string | null;
  rawRoles: string[] | null; // Guardamos el arreglo original por si lo necesitas luego
  expiracion: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

const storedUser = localStorage.getItem('user');
const storedToken = localStorage.getItem('token');
const storedRoles = localStorage.getItem('roles');
const storedExpiracion = localStorage.getItem('expiracion');

// --- NUEVA RED DE SEGURIDAD ---
// Esta función intenta leer el JSON. Si hay basura o datos viejos, no explota, 
// simplemente devuelve "null" y obliga al usuario a iniciar sesión de nuevo.
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
  user: safeJSONParse(storedUser),
  token: storedToken || null,
  rawRoles: safeJSONParse(storedRoles),
  expiracion: storedExpiracion || null,
  isAuthenticated: !!storedToken,
  isLoading: false,
  error: null,
};

// --- THUNK PARA EL LOGIN ASÍNCRONO ---
export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async (credentials: { userName: string; password: string }, { rejectWithValue }) => {
    try {
      // Usamos el tipo <AuthResponse> para que TypeScript sepa qué devuelve la API
      const response = await api.post<AuthResponse>(AUTH_ENDPOINTS.LOGIN, credentials);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return rejectWithValue(error.response?.data?.message || 'Error de conexión con el servidor');
      }
      if (error instanceof Error) return rejectWithValue(error.message);
      return rejectWithValue('Código o contraseña incorrectos');
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
        
        // --- NUEVO: PARSEADOR DE ERRORES DE .NET IDENTITY ---
        if (Array.isArray(errorData) && errorData.length > 0) {
          const errorCode = errorData[0].code;
          const errorDesc = errorData[0].description;
          
          // Traducimos el error más común al español
          if (errorCode === 'PasswordMismatch') {
            return rejectWithValue('La contraseña actual ingresada es incorrecta.');
          }
          return rejectWithValue(errorDesc);
        }

        // Fallback estándar
        return rejectWithValue(errorData?.message || 'Error al cambiar la contraseña');
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
      // Limpiamos absolutamente todo del localStorage
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
        
        // Adaptamos los datos del backend para que nuestra App no se rompa (Sidebar, etc.)
        const userData = {
          id: action.payload.datosAdicionales.sub,
          username: action.payload.datosAdicionales.username,
          email: action.payload.datosAdicionales.email,
          role: action.payload.roles[0] || 'clientes', // Tomamos el primer rol del arreglo (ej: "admin")
        };
        state.user = userData;

        // GUARDAMOS TODOS LOS PARÁMETROS EN EL LOCALSTORAGE
        localStorage.setItem('token', action.payload.token);
        localStorage.setItem('expiracion', action.payload.expiracion);
        // Al ser un arreglo y un objeto, hay que convertirlos a texto con JSON.stringify
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