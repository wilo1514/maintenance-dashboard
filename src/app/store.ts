import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice';
import usersReducer from '../features/admin/usersSlice';
import transfersReducer from '../features/tech/transfersSlice'; 
import transferItemsReducer  from '../features/tech/Transfers/transferItemsSlice';
import notificationsReducer from  '../features/notifications/notificationsSlice';
import repuestosReducer from '../features/tech/Repuestos/repuestosSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    adminUsers: usersReducer,
    techTransfers: transfersReducer, 
    techTransferItems: transferItemsReducer,// <-- 2. Añadir aquí
    notifications: notificationsReducer,
    techRepuestos: repuestosReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;