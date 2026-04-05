export const TECH_ENDPOINTS = {
  GET_CLIENTS: '/tech/clients',
  CREATE_CLIENT: '/tech/clients',
  GET_WORK_ORDERS: '/tech/work-orders',
  CREATE_WORK_ORDER: '/tech/work-orders',
  GET_INVENTORY: '/tech/inventory',
  
  CHANGE_PASSWORD: '/usuarios/cambiarpassword',
  GET_TRANSFERS: '/transferencias',
  GET_TRANSFER_BY_ID: (id: string | number) => `/transferencias/${id}`,
  POST_TRANSFER: '/transferencias',
  PUT_TRANSFER: (id: string | number) => `/transferencias/${id}`,
  POST_SAP_TRANSFER: '/sap/transferencias',

  // --- ENDPOINTS PARA CREACIÓN DE TRANSFERENCIAS ---
  GET_SAP_BODEGAS: '/sap/bodegas',
  GET_SAP_UBICACIONES: (whsCode: string) => `/sap/bodegas/${whsCode}/ubicaciones`,
  
  // ÍTEMS
  GET_SAP_ITEMS: '/sap/items',
  SEARCH_SAP_ITEMS_NOMBRE: '/sap/items/pornombre',
  SEARCH_SAP_ITEMS_ID: (id: string) => `/sap/items/${id}`,
};