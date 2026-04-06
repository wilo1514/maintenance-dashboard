export const TECH_ENDPOINTS = {
  GET_CLIENTS: '/tech/clients',
  CREATE_CLIENT: '/tech/clients',
  GET_WORK_ORDERS: '/tech/work-orders',
  CREATE_WORK_ORDER: '/tech/work-orders',
  GET_INVENTORY: '/tech/inventory',
  
  CHANGE_PASSWORD: '/usuarios/cambiarpassword',
  GET_TRANSFERS: '/transferencias', 

GET_TRANSFER_ITEMS: (transferId: string, bodega: string, ubicacion: string) => {
    // Lógica para saber si es borrador ('0-docEntry') o transferencia normal
    if (transferId.startsWith('0-')) {
      const docEntry = transferId.split('-')[1];
      return `/transferencias/0?docEntry=${docEntry}&bodega=${bodega}&ubicacion=${ubicacion}`;
    }
    return `/transferencias/${transferId}?bodega=${bodega}&ubicacion=${ubicacion}`;
  },
  
  // ... el resto de endpoints que ya tenías ...
  POST_TRANSFER: '/transferencias',
  PUT_TRANSFER: (id: number) => `/transferencias/${id}`,
  POST_SAP_TRANSFER: '/sap/transferencias',

  GET_SAP_BODEGAS: '/sap/bodegas',
  GET_SAP_UBICACIONES: (whsCode: string) => `/sap/bodegas/${whsCode}/ubicaciones`,
  GET_SAP_ITEMS: '/sap/items',
  SEARCH_SAP_ITEMS_NOMBRE: '/sap/items/search/nombre',
  SEARCH_SAP_ITEMS_ID: (id: string) => `/sap/items/${id}`,

  // NOTIFICACIONES (Añadido para tener todo centralizado)
  GET_NOTIFICATIONS: '/notificaciones',
  MARK_NOTIFICATION_READ: (id: number) => `/notificaciones/${id}/leer`,
  MARK_ALL_NOTIFICATIONS_READ: '/notificaciones/read-all',

};