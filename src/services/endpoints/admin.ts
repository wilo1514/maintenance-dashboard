export const ADMIN_ENDPOINTS = {
  GET_USERS: '/usuarios',
  CREATE_USER: '/usuarios',
  UPDATE_USER: '/usuarios', 
  RESET_PASSWORD: '/usuarios/resetpassword',
  MAKE_ADMIN: '/usuarios/haceradmin',
  REMOVE_ADMIN: '/usuarios/removeradmin',

  // --- NUEVOS ENDPOINTS DE SAP PARA CONFIGURAR USUARIOS ---
  GET_SAP_BODEGAS: '/sap/bodegas',
  GET_SAP_UBICACIONES: (whsCode: string) => `/sap/bodegas/${whsCode}/ubicaciones`,

  // endpoint para buscar el usuario en sap.
  SEARCH_SAP_USER: (codigo: string) => `/admin/sap-users/${codigo}`, 
};