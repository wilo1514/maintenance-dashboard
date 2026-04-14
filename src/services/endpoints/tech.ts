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
  GET_SAP_REPUESTOS: '/sap/repuestos',
  SEARCH_SAP_REPUESTOS_NOMBRE: '/sap/repuestos/pornombre',
  SEARCH_SAP_REPUESTOS_ID: (id: string) => `/sap/repuestos/${id}`,

  // NOTIFICACIONES (Añadido para tener todo centralizado)
  GET_NOTIFICATIONS: '/notificaciones',
  MARK_NOTIFICATION_READ: (id: number) => `/notificaciones/${id}/leer`,
  MARK_ALL_NOTIFICATIONS_READ: '/notificaciones/read-all',

  // --- ÓRDENES DE SERVICIO (LLAMADAS DE SERVICIO) ---
  GET_LLAMADAS: '/llamadas-servicio',
  GET_LLAMADA_BY_ID: (id: number | string) => `/llamadas-servicio/${id}`,
  POST_LLAMADA: '/llamadas-servicio',
  PUT_LLAMADA: (id: number | string) => `/llamadas-servicio/${id}`,
  DELETE_LLAMADA: (id: number | string) => `/llamadas-servicio/${id}`,
  PATCH_LLAMADA_ESTADO: (id: number | string) => `/llamadas-servicio/${id}/estado`,
  
  // ANEXOS DE LLAMADAS
  GET_LLAMADA_ANEXOS: (id: number | string) => `/llamadas-servicio/${id}/anexos`,
  POST_LLAMADA_ANEXO: '/llamadas-servicio/anexos',
  DELETE_LLAMADA_ANEXO: (id: number | string, anexoId: number | string) => `/llamadas-servicio/${id}/anexos/${anexoId}`,

  // --- CLIENTES UDO ---
  GET_CLIENTES: '/sap/udo/clientes',
  SEARCH_CLIENTES_NOMBRE: '/sap/udo/clientes/pornombre',
  SEARCH_CLIENTES_DOCUMENTO:(id:number | string) =>`/sap/udo/clientes/${id}`,
  POST_CLIENTE: '/sap/udo/clientes',

  // --- MOTIVOS (ASUNTOS) ---
  GET_MOTIVOS: '/motivos-incidencia-st',
  SEARCH_MOTIVOS_NOMBRE: '/motivos-incidencia-st/pornombre',
  POST_MOTIVO: '/motivos-incidencia-st',

  // --- ITEMS (EQUIPOS) ---
  GET_SAP_ITEMS: '/sap/items',
  SEARCH_SAP_ITEMS_NOMBRE: '/sap/items/pornombre', // <-- NUEVO
  SEARCH_SAP_ITEMS_ID: (id: string) => `/sap/items/${id}`, // <-- NUEVO

  // --- CATÁLOGOS LLS EN CASCADA ---
  GET_ORIGENES_LLS: '/sap/llamadaservicio/origenlls',
  GET_TIPOS_PROBLEMA_CATEGORIA: (categoria: number | string) => `/tipos-problema-st/porcategoria?categoria=${categoria}`,
  GET_SUBTIPOS_PROBLEMA_CATEGORIA: (categoria: number | string) => `/tipos-problema-st/porcategoria?categoria=${categoria}`,
  GET_TIPOS_LLS: '/sap/llamadaservicio/tiposlls',
  GET_TECNICOS_LLS: '/sap/llamadaservicio/tecnicolls',

  // --- MANO DE OBRA ---
  GET_MANO_OBRA: '/sap/udo/manoobra',
  SEARCH_MANO_OBRA_NOMBRE: '/sap/udo/manoobra/pornombre',

  // --- INTEGRACIÓN SAP DIRECTA ---
  POST_SAP_LLAMADA: (id: number | string) => `/sap/llamadaservicio/${id}`,
  PUT_SAP_LLAMADA: (id: number | string) => `/sap/llamadaservicio/${id}`,
  PATCH_SAP_LLAMADA_ESTADO: (id: number | string) => `/sap/llamadaservicio/${id}/estado`,

  // Soluciones ST
  GET_SOLUCIONES: '/soluciones-st',
  SEARCH_SOLUCIONES: (texto: string) => `/soluciones-st/buscar?texto=${texto}`,
  GET_SOLUCIONES_POR_ITEM: (item: string) => `/soluciones-st/poritem?item=${item}`,
  POST_SOLUCION: '/soluciones-st',
  
  // --- TRASLADOS SAP ---
  POST_SAP_TRASLADO: '/sap/solicitudestraslado',

};