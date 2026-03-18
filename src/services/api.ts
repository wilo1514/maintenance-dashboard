import axios from 'axios';

// Usamos las variables de entorno de Vite. 
// Si no existe, usamos localhost por defecto.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5295';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// INTERCEPTOR DE PETICIONES (REQUEST)
// Esto se ejecuta ANTES de que cualquier petición salga al servidor
api.interceptors.request.use(
  (config) => {
    // Obtenemos el token guardado (lo guardaremos en el paso 4)
    const token = localStorage.getItem('token');
    
    if (token) {
      // Si hay token, lo inyectamos en la cabecera de Autorización
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// INTERCEPTOR DE RESPUESTAS (RESPONSE) - Opcional pero recomendado
// Ideal para manejar errores globales, como cuando el token expira (Error 401)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Si el backend dice que no estamos autorizados (token inválido/expirado),
      // borramos los datos locales y forzamos recargar la página para ir al login.
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;