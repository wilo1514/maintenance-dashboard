export const TECH_ENDPOINTS = {
  GET_CLIENTS: '/tech/clients',
  CREATE_CLIENT: '/tech/clients',
  GET_WORK_ORDERS: '/tech/work-orders',
  CREATE_WORK_ORDER: '/tech/work-orders',
  GET_INVENTORY: '/tech/inventory',
  
  CHANGE_PASSWORD: '/usuarios/cambiarpassword',
  GET_TRANSFERS: '/transferencias', 

GET_TRANSFER_ITEMS: (transferId: string, bodega: string, ubicacion: string) => {
    if (transferId.startsWith('0-')) {
      const docEntry = transferId.split('-')[1];
      return `/transferencias/0?docEntry=${docEntry}&bodega=${bodega}&ubicacion=${ubicacion}`;
    }
    return `/transferencias/${transferId}?bodega=${bodega}&ubicacion=${ubicacion}`;
  },
  
  POST_TRANSFER: '/transferencias',
  PUT_TRANSFER: (id: number) => `/transferencias/${id}`,
  POST_SAP_TRANSFER: '/sap/transferencias',

  GET_SAP_BODEGAS: '/sap/bodegas',
  GET_SAP_UBICACIONES: (whsCode: string) => `/sap/bodegas/${whsCode}/ubicaciones`,
  GET_SAP_REPUESTOS: '/sap/repuestos',
  SEARCH_SAP_REPUESTOS_NOMBRE: '/sap/repuestos/pornombre',
  SEARCH_SAP_REPUESTOS_ID: (id: string) => `/sap/repuestos/${id}`,
  SEARCH_SAP_REPUESTOS_ID_STOCK: (id: string, whsCode: string, binLocation: string) =>
    `/sap/repuestos/${encodeURIComponent(id)}?whsCode=${whsCode}&binLocation=${binLocation}`,

  GET_NOTIFICATIONS: '/notificaciones',
  MARK_NOTIFICATION_READ: (id: number) => `/notificaciones/${id}/leer`,
  MARK_ALL_NOTIFICATIONS_READ: '/notificaciones/read-all',

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
  SEARCH_SAP_ITEMS_NOMBRE: '/sap/items/pornombre',
  SEARCH_SAP_ITEMS_ID: (id: string) => `/sap/items/${id}`,

  GET_ORIGENES_LLS: '/sap/llamadaservicio/origenlls',
  GET_TIPOS_PROBLEMA: '/tipos-problema-st',
  SEARCH_TIPOS_PROBLEMA_NOMBRE: '/tipos-problema-st/pornombre',
  POST_TIPO_PROBLEMA: '/tipos-problema-st',
  PUT_TIPO_PROBLEMA: (id: number | string) => `/tipos-problema-st/${encodeURIComponent(String(id))}`,
  DELETE_TIPO_PROBLEMA: (id: number | string) => `/tipos-problema-st/${encodeURIComponent(String(id))}`,
  GET_TIPOS_LLS: '/sap/llamadaservicio/tiposlls',
  GET_TECNICOS_LLS: '/sap/llamadaservicio/tecnicolls',

  // --- MANO DE OBRA ---
  GET_MANO_OBRA: '/sap/udo/manoobra',
  SEARCH_MANO_OBRA_NOMBRE: '/sap/udo/manoobra/pornombre',

  POST_SAP_LLAMADA: (id: number | string) => `/sap/llamadaservicio/${id}`,
  PUT_SAP_LLAMADA: (id: number | string) => `/sap/llamadaservicio/${id}`,
  PATCH_SAP_LLAMADA_ESTADO: (id: number | string) => `/sap/llamadaservicio/${id}/estado`,

  // Soluciones ST
  GET_SOLUCIONES: '/soluciones-st',
  SEARCH_SOLUCIONES: (texto: string) => `/soluciones-st/buscar?texto=${texto}`,
  GET_SOLUCIONES_POR_ITEM: (item: string) => `/soluciones-st/poritem?item=${item}`,
  POST_SOLUCION: '/soluciones-st',
  
  POST_SOLICITUD_TRANSFERENCIA: '/solicitudes-transferencia',
  GET_SOLICITUDES_TRANSFERENCIA: '/solicitudes-transferencia',
  GET_SOLICITUD_TRANSFERENCIA_BY_ID: (id: number | string) => `/solicitudes-transferencia/${id}`,
  PATCH_SOLICITUD_TRANSFERENCIA_ESTADO: (id: number | string) => `/solicitudes-transferencia/${id}/estado`,
  POST_SAP_TRASLADO: '/sap/solicitudestraslado',

  GET_ORDENES_COMPRA: '/ordenes-compra',
  GET_ORDEN_COMPRA_BY_ID: (id: number | string) => `/ordenes-compra/${id}`,
  PUT_ORDEN_COMPRA: (id: number | string) => `/ordenes-compra/${id}`,
  PATCH_ORDEN_COMPRA_ESTADO: (id: number | string) => `/ordenes-compra/${id}/estado`,
  POST_SAP_ORDEN_COMPRA: (llamadaId: number | string) => `/sap/ordenescompra/${llamadaId}`,
  POST_SAP_SALIDA_MERCANCIA: (llamadaId: number | string) => `/sap/salidasmercancia/${llamadaId}`,

  GET_LIQUIDACIONES: '/liquidaciones',
  GET_LIQUIDACION_BY_ID: (id: number | string) => `/liquidaciones/${id}`,
  POST_LIQUIDACION: '/liquidaciones',

};
