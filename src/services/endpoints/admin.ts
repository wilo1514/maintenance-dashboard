export const ADMIN_ENDPOINTS = {
  GET_USERS: '/usuarios',
  CREATE_USER: '/usuarios',
  UPDATE_USER: '/usuarios', 
  RESET_PASSWORD: '/usuarios/resetpassword',
  MAKE_ADMIN: '/usuarios/haceradmin',
  REMOVE_ADMIN: '/usuarios/removeradmin',

  // --- ENDPOINTS DE SAP ---
  GET_SAP_BODEGAS: '/sap/bodegas',
  GET_SAP_UBICACIONES: (whsCode: string) => `/sap/bodegas/${whsCode}/ubicaciones`,

  // CLIENTES
  GET_SAP_CLIENTES: '/sap/clientes',
  SEARCH_SAP_CLIENTES_NOMBRE: '/sap/clientes/pornombre',
  SEARCH_SAP_CLIENTES_ID: (id: string) => `/sap/clientes/${id}`,

  // PROVEEDORES
  GET_SAP_PROVEEDORES: '/sap/proveedores',
  SEARCH_SAP_PROVEEDORES_NOMBRE: '/sap/proveedores/pornombre',
  SEARCH_SAP_PROVEEDORES_ID: (id: string) => `/sap/proveedores/${id}`,

  SEARCH_SAP_USER: (codigo: string) => `/admin/sap-users/${codigo}`, 
};