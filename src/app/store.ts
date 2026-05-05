import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice';
import usersReducer from '../features/admin/usersSlice';
import transfersReducer from '../features/tech/transfersSlice'; 
import transferItemsReducer  from '../features/tech/Transfers/transferItemsSlice';
import notificationsReducer from  '../features/notifications/notificationsSlice';
import repuestosReducer from '../features/tech/Repuestos/repuestosSlice';
import llamadasReducer from '../features/tech/Llamadas/llamadasSlice';
import ordenesReducer from '../features/tech/Ordenes/ordenesCompraSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    adminUsers: usersReducer,
    techTransfers: transfersReducer, 
    techTransferItems: transferItemsReducer,
    notifications: notificationsReducer,
    techRepuestos: repuestosReducer,
    techLlamadas: llamadasReducer,
    techOrdenes: ordenesReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
