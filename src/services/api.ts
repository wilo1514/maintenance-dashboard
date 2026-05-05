import axios from 'axios';


const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:7018';
//const API_URL = import.meta.env.VITE_API_URL || 'http://10.10.2.122:8085';


const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// INTERCEPTOR DE PETICIONES (REQUEST)
api.interceptors.request.use(
  (config) => {
    // Obtenemos el token guardado (lo guardaremos en el paso 4)
    const token = localStorage.getItem('token');
    
    if (token) {
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
// INTERCEPTOR DE RESPUESTAS (RESPONSE)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
