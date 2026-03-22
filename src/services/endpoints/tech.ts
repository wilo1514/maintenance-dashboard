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
  // TODO: El backend debe arreglar este endpoint antes de usarlo
  // GET_TRANSFER_BY_DOC: (doc: string | number) => `/transferencias/documento/${doc}`,
  
  POST_TRANSFER: '/transferencias',
  PUT_TRANSFER: '/transferencias', // Asumimos que el PUT va a la raíz porque el ID va en el Body, si va en la URL sería `/transferencias/${id}`
};