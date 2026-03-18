import { useEffect, useCallback, useRef } from 'react';
import { useAppDispatch } from '../app/hooks';
import { logout } from '../features/auth/authSlice';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export const useAutoLogout = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  
  // Usamos useRef para mantener la referencia del temporizador de inactividad
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Definimos el tiempo de inactividad: 45 minutos (en milisegundos)
  const TIEMPO_INACTIVIDAD = 45 * 60 * 1000;

  // Función centralizada para cerrar sesión
  const performLogout = useCallback((mensaje: string) => {
    dispatch(logout());
    toast.info(mensaje); // Usamos info o error dependiendo de qué tan grave suene
    navigate('/login');
  }, [dispatch, navigate]);

  // ==========================================================
  // 1. SISTEMA DE INACTIVIDAD (45 MINUTOS)
  // ==========================================================
  const resetInactivityTimer = useCallback(() => {
    // Si ya había un temporizador contando, lo borramos
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    // Iniciamos un nuevo temporizador desde cero
    inactivityTimerRef.current = setTimeout(() => {
      performLogout('Tu sesión se cerró por inactividad (45 min).');
    }, TIEMPO_INACTIVIDAD);
  }, [performLogout, TIEMPO_INACTIVIDAD]);

  useEffect(() => {
    // Escuchamos cualquier movimiento del usuario para reiniciar el reloj
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    
    const handleActivity = () => resetInactivityTimer();

    // Arrancamos el reloj la primera vez que entra al sistema
    resetInactivityTimer();

    // Le pegamos los "sensores" a la ventana del navegador
    events.forEach(event => window.addEventListener(event, handleActivity));

    // Limpieza si el usuario cierra la pestaña o sale
    return () => {
      events.forEach(event => window.removeEventListener(event, handleActivity));
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, [resetInactivityTimer]);

  // ==========================================================
  // 2. SISTEMA DE EXPIRACIÓN DEL TOKEN (.NET - 1 AÑO)
  // ==========================================================
  useEffect(() => {
    // Este vigilante revisa el reloj cada 1 minuto sin estresar el navegador
    const interval = setInterval(() => {
      const expiracionStr = localStorage.getItem('expiracion');
      
      if (expiracionStr) {
        const expiracionDate = new Date(expiracionStr).getTime();
        const ahora = new Date().getTime();

        // Si ya pasó el año exacto de expiración, lo sacamos
        if (ahora >= expiracionDate) {
          clearInterval(interval);
          performLogout('Tu credencial de acceso ha expirado. Por favor, ingresa de nuevo.');
        }
      }
    }, 60000); 

    return () => clearInterval(interval);
  }, [performLogout]);
};