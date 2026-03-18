export const ADMIN_ENDPOINTS = {
  GET_USERS: '/usuarios/listar',
  CREATE_USER: '/usuarios/crear',
  UPDATE_USER: '/usuarios/modificar', // El backend usa PATCH aquí
  RESET_PASSWORD: '/usuarios/resetpassword',
  MAKE_ADMIN: '/usuarios/haceradmin',
  REMOVE_ADMIN: '/usuarios/removeradmin',
  

  // endpoint para buscar el usuario en sap.
  SEARCH_SAP_USER: (codigo: string) => `/admin/sap-users/${codigo}`, 
};