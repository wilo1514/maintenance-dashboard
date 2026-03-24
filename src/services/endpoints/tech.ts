export const TECH_ENDPOINTS = {
  GET_CLIENTS: '/tech/clients',
  CREATE_CLIENT: '/tech/clients',
  GET_WORK_ORDERS: '/tech/work-orders',
  CREATE_WORK_ORDER: '/tech/work-orders',
  GET_INVENTORY: '/tech/inventory',
  
  CHANGE_PASSWORD: '/usuarios/cambiarpassword',
  GET_TRANSFERS: '/transferencias',
  
  // ENDPOINTS PARA LOS ITEMS DE TRANSFERENCIA
  GET_TRANSFER_BY_ID: (id: string | number) => `/transferencias/${id}`,
  POST_TRANSFER: '/transferencias',
  PUT_TRANSFER: (id: string | number) => `/transferencias/${id}`,
  
  // NUEVO ENDPOINT DE SAP
  POST_SAP_TRANSFER: '/sap/transferencias',
};