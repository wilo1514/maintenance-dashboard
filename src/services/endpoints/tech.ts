export const TECH_ENDPOINTS = {
  GET_CLIENTS: '/tech/clients',
  CREATE_CLIENT: '/tech/clients',
  GET_WORK_ORDERS: '/tech/work-orders',
  CREATE_WORK_ORDER: '/tech/work-orders',
  GET_INVENTORY: '/tech/inventory',
  
  // NUEVOS ENDPOINTS REALES
  CHANGE_PASSWORD: '/usuarios/cambiarpassword',
  GET_TRANSFERS: '/transferencias',
  GET_TRANSFER_BY_ID: (id: string | number) => `/transferencias/${id}`,
};