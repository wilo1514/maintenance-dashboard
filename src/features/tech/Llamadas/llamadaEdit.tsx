import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, TextField, Button, MenuItem, CircularProgress,
  IconButton, Avatar, Tabs, Tab, TableContainer, Table, TableHead, Divider,
  TableRow, TableCell, TableBody, Dialog, DialogTitle, DialogContent, DialogActions,
  Autocomplete, Chip, Alert, Switch, FormControlLabel, useMediaQuery, Card, CardContent, Stack
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BuildCircleIcon from '@mui/icons-material/BuildCircle';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import ShoppingCartCheckoutIcon from '@mui/icons-material/ShoppingCartCheckout';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CancelIcon from '@mui/icons-material/Cancel';
import DownloadIcon from '@mui/icons-material/Download';
import SendIcon from '@mui/icons-material/Send';
import SyncIcon from '@mui/icons-material/Sync'; 
import TaskAltIcon from '@mui/icons-material/TaskAlt'; // <-- Icono para el modal de Cierre

import { useAppSelector } from '../../../app/hooks';
import { selectCurrentUser } from '../../auth/authSlice';
import api from '../../../services/api';
import { TECH_ENDPOINTS } from '../../../services/endpoints/tech';
import { type LlamadaServicio, type LlamadaAnexo, type LlamadaDetalle as OriginalLlamadaDetalle } from './llamadasSlice';

interface RepuestoOption { itemCode: string; itemName: string; onHandQty: number; avgPrice: number; }
interface ManoObraOption { code: string; name: string; u_NA_ITEM: string; u_NA_VALOR: number; }
type BusquedaOption = RepuestoOption | ManoObraOption;
const isRepuesto = (opt: BusquedaOption): opt is RepuestoOption => 'itemCode' in opt;

interface LlamadaDetalleUI extends Omit<OriginalLlamadaDetalle, 'cantidad' | 'costo'> {
  cantidad: string | number;
  costo: string | number;
  _missingStock?: boolean;
  _transferRequested?: boolean;
  _onHandLimit?: number;
}

interface OrigenOption { originID: number; name: string; }
interface TipoProblemaOption { id: string; nombre: string; }
interface TecnicoOption { empID: number; name: string; }

// --- NUEVAS INTERFACES PARA LA SOLUCIÓN ---
interface SolucionOpcion {
  id: number;
  item: string;
  descripcion: string;
  solucion: string;
  sintoma: string;
  causa: string;
  comentarios: string;
}

const getLocalISOString = () => {
  const date = new Date();
  const tzoffset = date.getTimezoneOffset() * 60000; 
  return new Date(date.getTime() - tzoffset).toISOString().slice(0, -1) + 'Z'; 
};

export const LlamadaEdit = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAppSelector(selectCurrentUser);
  const isFT1 = user?.ubicacion === '05-FT1';

  const [llamada, setLlamada] = useState<LlamadaServicio | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tabIndex, setTabIndex] = useState(0);

  const [detallesLocales, setDetallesLocales] = useState<LlamadaDetalleUI[]>([]);
  const [isCheckingStock, setIsCheckingStock] = useState(false); 

  const [origenes, setOrigenes] = useState<OrigenOption[]>([]);
  const [tiposProblema, setTiposProblema] = useState<TipoProblemaOption[]>([]);
  const [subtiposProblema, setSubtiposProblema] = useState<TipoProblemaOption[]>([]);
  const [tecnicos, setTecnicos] = useState<TecnicoOption[]>([]);

  const [modalDetalleOpen, setModalDetalleOpen] = useState(false);
  const [tipoDetalle, setTipoDetalle] = useState('REPUESTO'); 
  const [opcionesBusqueda, setOpcionesBusqueda] = useState<BusquedaOption[]>([]);
  const [isBuscando, setIsBuscando] = useState(false);

  const [nuevoDetalle, setNuevoDetalle] = useState({
    itemDetalleId: '', itemSAP: '', descripcion: '', cantidad: '1', costo: '0', valor: 0, onHandQty: 0
  });

  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferComments, setTransferComments] = useState('');

  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- ESTADOS PARA EL MODAL DE CIERRE Y SOLUCIÓN ---
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [isNewSolucion, setIsNewSolucion] = useState(false);
  const [isLoadingSolutions, setIsLoadingSolutions] = useState(false);
  const [solucionesOpciones, setSolucionesOpciones] = useState<SolucionOpcion[]>([]);
  const [isBuscandoSoluciones, setIsBuscandoSoluciones] = useState(false);
  const [solucionSeleccionada, setSolucionSeleccionada] = useState<SolucionOpcion | null>(null);

  const [nuevaSolucion, setNuevaSolucion] = useState({
    item: '',
    descripcion: '',
    solucion: '',
    sintoma: '',
    causa: '',
    comentarios: ''
  });

  // 🚨 REVALIDACIÓN DE STOCK REFORZADA
  const revalidarStockEnVivo = async (detallesParaRevisar: LlamadaDetalleUI[]) => {
    setIsCheckingStock(true);
    try {
      const updatedDetalles = await Promise.all(detallesParaRevisar.map(async (d) => {
        const codigoRepuesto = d.itemSAP || d.itemDetalleId; 
        
        if (d.tipo === 'REPUESTO' && codigoRepuesto) {
          try {
            const url = `${TECH_ENDPOINTS.SEARCH_SAP_REPUESTOS_NOMBRE}?nombre=${encodeURIComponent(codigoRepuesto.toString())}&whsCode=${user?.idbranch}&binLocation=${user?.ubicacion}&top=20&skip=0`;
            const res = await api.get(url);
            const items = res.data.items || res.data.registros || res.data || [];
            
            let match = items.find((itm: RepuestoOption) => itm.itemCode === codigoRepuesto);

            // Si no hay match, intentar por el endpoint de ID directo
            if (!match) {
              const urlId = `${TECH_ENDPOINTS.SEARCH_SAP_REPUESTOS_ID(encodeURIComponent(codigoRepuesto.toString()))}?whsCode=${user?.idbranch}&binLocation=${user?.ubicacion}&top=20&skip=0`;
              const resId = await api.get(urlId);
              const idItems = resId.data.items || resId.data.registros || resId.data || [];
              match = idItems.find((itm: RepuestoOption) => itm.itemCode === codigoRepuesto) || idItems[0];
            }
            
            if (match) {
              const currentOnHand = match.onHandQty || 0;
              const isMissingNow = Number(d.cantidad) > currentOnHand;
              return { 
                ...d, 
                _onHandLimit: currentOnHand, 
                _missingStock: isMissingNow,
                // 🚨 IMPORTANTE: Si ya hay stock, se apaga la solicitud de traslado automáticamente
                _transferRequested: isMissingNow ? d._transferRequested : false 
              };
            } else {
              return { ...d, _onHandLimit: 0, _missingStock: true, _transferRequested: d._transferRequested || false };
            }
          } catch (error) {
            console.error(`Error verificando stock en vivo de ${codigoRepuesto}:`, error);
            return { ...d, _onHandLimit: 0, _missingStock: true, _transferRequested: d._transferRequested || false };
          }
        }
        return d;
      }));
      setDetallesLocales(updatedDetalles);
      toast.success("Stock actualizado desde SAP");
    } finally {
      setIsCheckingStock(false);
    }
  };

  useEffect(() => {
    const fetchDatos = async () => {
      if (!id) return;
      try {
        const [resLlamada, resOrigenes, resTecnicos] = await Promise.all([
          api.get<LlamadaServicio>(TECH_ENDPOINTS.GET_LLAMADA_BY_ID(id)),
          api.get(TECH_ENDPOINTS.GET_ORIGENES_LLS),
          api.get(TECH_ENDPOINTS.GET_TECNICOS_LLS)
        ]);
        
        setLlamada(resLlamada.data);
        setOrigenes(resOrigenes.data.registros || []);
        setTecnicos(resTecnicos.data.registros || []);

        const detallesCrudos = (resLlamada.data.detalles || []) as LlamadaDetalleUI[];
        await revalidarStockEnVivo(detallesCrudos);

      } catch (err) {
        console.error(err);
        toast.error("Error al cargar la orden o catálogos");
        navigate('/tech/llamadas');
      } finally {
        setIsLoading(false);
      }
    };
    fetchDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, navigate, user?.idbranch, user?.ubicacion]);

  useEffect(() => {
    if (llamada?.origenLLSId) {
      Promise.all([
        api.get(TECH_ENDPOINTS.GET_TIPOS_PROBLEMA_CATEGORIA(llamada.origenLLSId)),
        api.get(TECH_ENDPOINTS.GET_SUBTIPOS_PROBLEMA_CATEGORIA(llamada.origenLLSId))
      ]).then(([resTipos, resSubtipos]) => {
        setTiposProblema(resTipos.data || []);
        setSubtiposProblema(resSubtipos.data || []);
      }).catch(console.error);
    }
  }, [llamada?.origenLLSId]);

  const subtiposFiltrados = subtiposProblema.filter(sp => sp.id !== llamada?.tipoProblemaSTId);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !id) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append('id', id);
    formData.append('archivo', file);
    try {
      const res = await api.post<LlamadaAnexo[]>(TECH_ENDPOINTS.POST_LLAMADA_ANEXO, formData, { headers: { 'Content-Type': 'multipart/form-data' }});
      setLlamada(prev => prev ? { ...prev, anexos: res.data } : null);
      toast.success("Archivo subido correctamente");
    } catch (err) { console.error(err); toast.error("Error al subir el archivo"); } 
    finally { setIsUploading(false); event.target.value = ''; }
  };

  const handleDeleteAnexo = async (anexoId: number) => {
    if (!id) return;
    try {
      await api.delete(TECH_ENDPOINTS.DELETE_LLAMADA_ANEXO(id, anexoId));
      setLlamada(prev => prev ? { ...prev, anexos: prev.anexos.filter(a => a.id !== anexoId) } : null);
      toast.info("Anexo eliminado");
    } catch (err) { console.error(err); toast.error("Error al eliminar anexo"); }
  };

  const buscarItems = async (query: string) => {
    if (query.length < 3) return;
    setIsBuscando(true);
    try {
      const url = tipoDetalle === 'REPUESTO'
        ? `${TECH_ENDPOINTS.SEARCH_SAP_REPUESTOS_NOMBRE}?nombre=${encodeURIComponent(query)}&whsCode=${user?.idbranch}&binLocation=${user?.ubicacion}`
        : `${TECH_ENDPOINTS.SEARCH_MANO_OBRA_NOMBRE}?nombre=${encodeURIComponent(query)}`;
      const res = await api.get(url);
      const data = res.data.items || res.data.registros || res.data || [];
      setOpcionesBusqueda(Array.isArray(data) ? data : [data]);
    } catch (err) { console.error(err); } finally { setIsBuscando(false); }
  };

  const handleAgregarDetalle = () => {
    if (tipoDetalle !== 'MANUAL' && !nuevoDetalle.itemDetalleId) return toast.warning("Selecciona un ítem válido");
    
    if (tipoDetalle !== 'MANUAL') {
      const codigoAInsertar = nuevoDetalle.itemSAP || nuevoDetalle.itemDetalleId;
      const existe = detallesLocales.find(d => (d.itemSAP || d.itemDetalleId) === codigoAInsertar);
      if (existe) {
        toast.warning('Este ítem ya está en la lista. Por favor, modifique la cantidad del existente.');
        return;
      }
    }

    const qty = Number(nuevoDetalle.cantidad) || 0;
    const cst = Number(nuevoDetalle.costo) || 0;

    const baseDetalle: LlamadaDetalleUI = {
      id: 0, llamadaServicioId: Number(id), tipo: tipoDetalle,
      cantidad: qty, costo: cst, valor: qty * cst,
      descripcion: nuevoDetalle.descripcion,
      usuFechaCrea: getLocalISOString()
    };

    if (tipoDetalle !== 'MANUAL') {
       baseDetalle.itemDetalleId = nuevoDetalle.itemDetalleId;
       baseDetalle.itemSAP = nuevoDetalle.itemSAP;
    }

    if (tipoDetalle === 'REPUESTO' && qty > nuevoDetalle.onHandQty) {
      if (llamada?.estado === 'S') {
        toast.error("En estado Stock Pendiente (S) no puedes agregar más repuestos sin stock.");
        return; 
      }
      baseDetalle._missingStock = true; 
      baseDetalle._onHandLimit = nuevoDetalle.onHandQty;
    }

    setDetallesLocales([...detallesLocales, baseDetalle]);
    setModalDetalleOpen(false);
    setNuevoDetalle({ itemDetalleId: '', itemSAP: '', descripcion: '', cantidad: '1', costo: '0', valor: 0, onHandQty: 0 });
  };

  const handleEditInline = (index: number, field: 'cantidad' | 'costo', value: string) => {
    const updated = [...detallesLocales];
    updated[index][field] = value; 
    
    const cant = Number(updated[index].cantidad) || 0;
    const cost = Number(updated[index].costo) || 0;
    updated[index].valor = cant * cost;

    if (field === 'cantidad' && updated[index].tipo === 'REPUESTO' && updated[index]._onHandLimit !== undefined) {
      if (cant > updated[index]._onHandLimit!) {
        updated[index]._missingStock = true;
      } else {
        updated[index]._missingStock = false; updated[index]._transferRequested = false;
      }
    }
    setDetallesLocales(updated);
  };

  const handleToggleMissingStock = (index: number, action: 'TRANSFER' | 'MANUAL', checked?: boolean) => {
    const updated = [...detallesLocales];
    if (action === 'TRANSFER') {
      updated[index]._transferRequested = checked;
    } else if (action === 'MANUAL') {
      updated[index].tipo = 'MANUAL';
      updated[index].descripcion = `(Local) ${updated[index].descripcion || updated[index].itemDetalleId}`;
      delete updated[index].itemDetalleId;
      delete updated[index].itemSAP;
      updated[index]._missingStock = false; 
      updated[index]._transferRequested = false;
    }
    setDetallesLocales(updated);
  };

  const handleQuitarDetalle = (index: number) => {
    setDetallesLocales(detallesLocales.filter((_, idx) => idx !== index));
  };

  // --- BÚSQUEDA Y APERTURA DE MODAL DE SOLUCIONES ---
  const handleOpenCloseModal = async () => {
    setCloseModalOpen(true);
    setIsLoadingSolutions(true);
    try {
      let itemName = llamada?.itemIncidenciaId || '';
      try {
        const resItem = await api.get(`${TECH_ENDPOINTS.SEARCH_SAP_ITEMS_NOMBRE}?nombre=${encodeURIComponent(itemName)}&top=1&skip=0`);
        const itemsList = resItem.data.items || resItem.data || [];
        if (itemsList.length > 0) itemName = itemsList[0].itemName;
      } catch (e) { console.error("Item name fetch failed", e); }

      let motivoName = '';
      try {
        const resMotivo = await api.get(`/motivos-incidencia-st?top=100&skip=0`);
        const motivosList = resMotivo.data.registros || resMotivo.data || [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const matchedMotivo = motivosList.find((m: any) => m.id === llamada?.motivoIncidenciaSTId);
        if (matchedMotivo) motivoName = matchedMotivo.nombre;
      } catch (e) { console.error("Motivo name fetch failed", e); }

      setNuevaSolucion(prev => ({
        ...prev,
        item: llamada?.itemIncidenciaId || '',
        descripcion: itemName,
        sintoma: motivoName
      }));

      const resSoluciones = await api.get(TECH_ENDPOINTS.GET_SOLUCIONES_POR_ITEM(llamada?.itemIncidenciaId || ''));
      setSolucionesOpciones(resSoluciones.data || []);
    } catch (e) {
      console.error("Error loading close modal data", e);
    } finally {
      setIsLoadingSolutions(false);
    }
  };

  const buscarSoluciones = async (query: string) => {
    if (query.length < 3) return;
    setIsBuscandoSoluciones(true);
    try {
      const res = await api.get(TECH_ENDPOINTS.SEARCH_SOLUCIONES(query));
      setSolucionesOpciones(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsBuscandoSoluciones(false);
    }
  };

  const handleAccionPrincipal = async (accion: 'ACTUALIZAR' | 'TRASLADO' | 'ABRIR' | 'ABRIR_DESDE_S' | 'CERRAR' | 'AUTORIZAR' | 'NEGAR' | 'ENVIAR_AUTORIZAR' | 'ABRIR_DIRECTO', solucionSTId: number = 0) => {
    if (!llamada || isSubmitting) return;
    
    if (accion === 'ENVIAR_AUTORIZAR' || accion === 'ABRIR_DIRECTO') {
      if (!llamada.anexos || llamada.anexos.length === 0) {
        toast.warning("⚠️ Debes subir al menos un anexo (Documento/Imagen) antes de enviar a SAP.");
        setTabIndex(2);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const fechaActual = getLocalISOString();

      const detallesLimpios = detallesLocales.map(d => {
        const det: Partial<OriginalLlamadaDetalle> = {
          llamadaServicioId: d.llamadaServicioId, tipo: d.tipo, descripcion: d.descripcion,
          cantidad: Number(d.cantidad) || 0, costo: Number(d.costo) || 0, valor: d.valor,
        };
        if (d.tipo !== 'MANUAL') {
           det.itemDetalleId = d.itemDetalleId;
           det.itemSAP = d.itemSAP;
        }
        if (d.id && d.id !== 0) det.id = d.id;
        return det as OriginalLlamadaDetalle;
      });

      const payloadSQL = { ...llamada, usuFechaModifica: fechaActual, detalles: detallesLimpios };
      delete (payloadSQL as { estado?: string }).estado; 

      if (accion === 'ENVIAR_AUTORIZAR') {
        toast.info("1/2: Guardando orden final en SQL...");
        await api.put(TECH_ENDPOINTS.PUT_LLAMADA(llamada.id), payloadSQL);
        
        toast.info("2/2: Generando orden en SAP (Pendiente)...");
        await api.post(TECH_ENDPOINTS.POST_SAP_LLAMADA(llamada.id), {});
        
        setLlamada({ ...llamada, usuFechaModifica: fechaActual, detalles: detallesLimpios, nroInterno: 1 });
        toast.success("¡Orden enviada a SAP exitosamente!");
        navigate('/tech/llamadas');
        return;
      }

      else if (accion === 'AUTORIZAR') {
        toast.info("1/2: Autorizando en SQL...");
        await api.patch(TECH_ENDPOINTS.PATCH_LLAMADA_ESTADO(llamada.id), { estado: 'A', solucionSTId: 0 });
        toast.info("2/2: Autorizando estado en SAP...");
        await api.patch(TECH_ENDPOINTS.PATCH_SAP_LLAMADA_ESTADO(llamada.id), { estado: 'A', solucionSTId: 0 });
        
        toast.success("¡Orden Autorizada!");
        navigate('/tech/llamadas/aprobaciones');
        return;
      }
      
      else if (accion === 'NEGAR') {
        toast.info("Negando orden...");
        await api.patch(TECH_ENDPOINTS.PATCH_LLAMADA_ESTADO(llamada.id), { estado: 'N', solucionSTId: 0 });
        toast.success("Orden Negada.");
        navigate('/tech/llamadas/aprobaciones'); 
        return;
      }

      else if (accion === 'ABRIR_DIRECTO') {
        toast.info("1/4: Guardando orden en SQL...");
        await api.put(TECH_ENDPOINTS.PUT_LLAMADA(llamada.id), payloadSQL);
        toast.info("2/4: Registrando orden en SAP...");
        await api.post(TECH_ENDPOINTS.POST_SAP_LLAMADA(llamada.id), {});
        toast.info("3/4: Abriendo orden en SQL...");
        await api.patch(TECH_ENDPOINTS.PATCH_LLAMADA_ESTADO(llamada.id), { estado: 'T', solucionSTId: 0 });
        toast.info("4/4: Sincronizando estado en SAP...");
        await api.patch(TECH_ENDPOINTS.PATCH_SAP_LLAMADA_ESTADO(llamada.id), { estado: 'T', solucionSTId: 0 });
        
        setLlamada({ ...llamada, estado: 'T', usuFechaModifica: fechaActual, detalles: detallesLimpios });
        toast.success("¡Orden Creada y Abierta en SAP con éxito (Estado: T)!");
      }
      
      else if (accion === 'TRASLADO') {
        const detallesSQL = detallesLocales.filter(d => d._transferRequested).map(d => {
            const limit = d._onHandLimit || 0;
            const missing = (Number(d.cantidad) || 0) - limit;
            return { item: (d.itemSAP || d.itemDetalleId || '').toString(), descripcion: d.descripcion || '', cantidadSolicitada: missing > 0 ? missing : 1, cantidadEntregada: 0 };
        });

        const trasladoSQLPayload = {
          nroInterno: 0, nroDocumento: 0, fecha: fechaActual, 
          bodegaDesde: "05", ubicacionDesde: "05-FT1", bodegaHasta: user?.idbranch || '', ubicacionHasta: user?.ubicacion || '',
          estado: "P", nroServicio: llamada.id.toString(), clienteId: user?.codigocliente || '', comentarios: transferComments, detalles: detallesSQL
        };

        toast.info("1/5: Registrando Solicitud en SQL...");
        const sqlRes = await api.post('/solicitudes-transferencia', trasladoSQLPayload);
        const nuevaSolicitudId = (typeof sqlRes.data === 'object' && sqlRes.data.id) ? sqlRes.data.id : sqlRes.data;

        const detallesSAP = detallesLocales.filter(d => d._transferRequested).map(d => {
            const limit = d._onHandLimit || 0;
            const missing = (Number(d.cantidad) || 0) - limit;
            return { itemCode: (d.itemSAP || d.itemDetalleId || '').toString(), quantity: missing > 0 ? missing : 1 };
        });

        const trasladoSAPPayload = {
          solicitudTransferenciaId: Number(nuevaSolicitudId), fecha: fechaActual, 
          bodegaDesde: "05", ubicacionDesde: "05-FT1", bodegaHasta: user?.idbranch || '', ubicacionHasta: user?.ubicacion || '',
          estado: "P", nroServicio: llamada.id.toString(), clienteId: user?.codigocliente || '', comentarios: transferComments, detalles: detallesSAP
        };

        toast.info("2/5: Enviando Solicitud a SAP...");
        await api.post(TECH_ENDPOINTS.POST_SAP_TRASLADO, trasladoSAPPayload);
        toast.info("3/5: Guardando orden en SQL...");
        await api.put(TECH_ENDPOINTS.PUT_LLAMADA(llamada.id), payloadSQL);
        toast.info("4/5: Sincronizando con SAP...");
        await api.put(TECH_ENDPOINTS.PUT_SAP_LLAMADA(llamada.id), {}); 
        toast.info("5/5: Cambiando estados a 'S'...");
        await api.patch(TECH_ENDPOINTS.PATCH_LLAMADA_ESTADO(llamada.id), { estado: 'S', solucionSTId: 0 });
        await api.patch(TECH_ENDPOINTS.PATCH_SAP_LLAMADA_ESTADO(llamada.id), { estado: 'S', solucionSTId: 0 });
        
        setTransferModalOpen(false);
        toast.success("¡Traslado solicitado exitosamente!");
        navigate('/tech/llamadas');
        return;
      }
      
      else if (accion === 'ABRIR' || accion === 'ABRIR_DESDE_S') {
        toast.info("1/3: Guardando orden en SQL...");
        await api.put(TECH_ENDPOINTS.PUT_LLAMADA(llamada.id), payloadSQL);
        toast.info("2/3: Sincronizando con SAP...");
        await api.put(TECH_ENDPOINTS.PUT_SAP_LLAMADA(llamada.id), {});
        toast.info("3/3: Abriendo orden (Estado T)...");
        await api.patch(TECH_ENDPOINTS.PATCH_LLAMADA_ESTADO(llamada.id), { estado: 'T', solucionSTId: 0 });
        await api.patch(TECH_ENDPOINTS.PATCH_SAP_LLAMADA_ESTADO(llamada.id), { estado: 'T', solucionSTId: 0 });
        setLlamada({ ...llamada, estado: 'T', usuFechaModifica: fechaActual, detalles: detallesLimpios });
        toast.success("¡Orden Abierta y lista para procesar (Estado: T)!");
      }
      
      // 🚨 FLUJO DE CIERRE MODIFICADO (ESTADO C)
      else if (accion === 'CERRAR') {
        toast.info("1/3: Guardando cambios finales en SQL...");
        await api.put(TECH_ENDPOINTS.PUT_LLAMADA(llamada.id), payloadSQL);
        toast.info("2/3: Sincronizando con SAP...");
        await api.put(TECH_ENDPOINTS.PUT_SAP_LLAMADA(llamada.id), {});
        toast.info("3/3: Cerrando orden (Estado C)...");
        
        // 🚨 SE ENVÍA EL ID DE LA SOLUCIÓN
        await api.patch(TECH_ENDPOINTS.PATCH_LLAMADA_ESTADO(llamada.id), { estado: 'C', solucionSTId });
        await api.patch(TECH_ENDPOINTS.PATCH_SAP_LLAMADA_ESTADO(llamada.id), { estado: 'C', solucionSTId });
        
        toast.success("¡Orden Cerrada con éxito (Estado: C)!");
        navigate('/tech/llamadas');
        return;
      }
      
      else if (accion === 'ACTUALIZAR') {
        toast.info("Guardando en SQL...");
        await api.put(TECH_ENDPOINTS.PUT_LLAMADA(llamada.id), payloadSQL);
        
        if (llamada.estado === 'A' || llamada.estado === 'S' || llamada.estado === 'T') {
           toast.info("Sincronizando detalles adicionales con SAP...");
           await api.put(TECH_ENDPOINTS.PUT_SAP_LLAMADA(llamada.id), {});
        }
        setLlamada({ ...llamada, usuFechaModifica: fechaActual, detalles: detallesLimpios });
        toast.success("Cambios guardados correctamente.");
      }

    } catch (err) {
      console.error(err);
      toast.error("Ocurrió un error en la sincronización. Revisa la consola.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmCloseOS = async () => {
    let solucionFinalId = 0;
    
    if (isNewSolucion) {
      if (!nuevaSolucion.solucion || !nuevaSolucion.causa) {
        toast.warning("La Solución y Causa son obligatorias para crear un nuevo registro.");
        return;
      }
      try {
        const res = await api.post(TECH_ENDPOINTS.POST_SOLUCION, nuevaSolucion);
        solucionFinalId = res.data.id || res.data;
      } catch (e) {
        toast.error("Error al guardar la nueva solución en la Base de Datos." );
        console.log(e)
        return;
      }
    } else {
      if (!solucionSeleccionada) {
        toast.warning("Debe seleccionar una solución existente de la lista.");
        return;
      }
      solucionFinalId = solucionSeleccionada.id;
    }

    setCloseModalOpen(false);
    handleAccionPrincipal('CERRAR', solucionFinalId);
  };

  const handleIntentoAbrir = (accion: 'ABRIR' | 'ABRIR_DIRECTO') => {
    const hayFaltantes = detallesLocales.some(d => d._missingStock && !d._transferRequested);
    if (hayFaltantes) {
      const missingItems = detallesLocales.filter(d => d._missingStock && !d._transferRequested).map(d => d.descripcion || d.itemDetalleId).join(', ');
      toast.error(`No tiene stock de: ${missingItems}. Actualice su stock y vuelva a intentar.`);
    } else {
      handleAccionPrincipal(accion);
    }
  };

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 10 }}><CircularProgress /></Box>;
  if (!llamada) return <Typography align="center" mt={5}>Orden no encontrada</Typography>;

  const currentState = llamada.estado;
  const isBorrador = currentState === 'P'; 
  const isOwnOrder = llamada.ubicacion === '05-FT1';
  const isCerrado = currentState === 'C';

  const hasTransfers = detallesLocales.some(d => d._transferRequested);
  const hasMissingStock = detallesLocales.some(d => d._missingStock && !d._transferRequested);
  const hasManual = detallesLocales.some(d => d.tipo === 'MANUAL');

  const renderEstadoLabel = (e: string) => {
    if (e === 'P') return 'PENDIENTE (P)';
    if (e === 'A') return 'AUTORIZADO (A)';
    if (e === 'T') return 'ABIERTO (T)';
    if (e === 'S') return 'STOCK PENDIENTE (S)';
    if (e === 'N') return 'NEGADO (N)';
    if (e === 'C') return 'CERRADO (C)';
    return e;
  };

  return (
    <Box sx={{ pb: { xs: 10, md: 4 }, maxWidth: 1200, margin: '0 auto' }}>
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton onClick={() => navigate(-1)} sx={{ mr: 1, bgcolor: 'background.paper', boxShadow: 1 }}><ArrowBackIcon /></IconButton>
          <Avatar sx={{ bgcolor: 'secondary.main', mr: 2 }}><BuildCircleIcon /></Avatar>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>Orden #{llamada.id}</Typography>
            <Typography variant="body2" color="text.secondary">Fecha: {llamada.fecha.split('T')[0]}</Typography>
          </Box>
        </Box>
        <Chip label={`ESTADO: ${renderEstadoLabel(currentState)}`} color={currentState === 'C' ? 'default' : currentState === 'T' ? 'success' : currentState === 'N' ? 'error' : currentState === 'S' ? 'warning' : 'primary'} sx={{ fontWeight: 'bold', px: 2, py: 2, fontSize: '1rem' }} />
      </Box>

      {hasTransfers && currentState === 'A' && (
        <Alert severity="warning" sx={{ mb: 3, fontWeight: 'bold' }}>
          Existen ítems marcados para Solicitud de Traslado. Asegúrate de enviar la solicitud antes de procesar la orden.
        </Alert>
      )}
      
      {isCerrado && (
        <Alert severity="info" sx={{ mb: 3, fontWeight: 'bold' }}>
          Esta Orden de Servicio está Cerrada. Sus datos son solo de lectura.
        </Alert>
      )}

      <Paper sx={{ borderRadius: 2 }}>
        <Tabs value={tabIndex} onChange={(evt, newVal) => { evt.stopPropagation(); setTabIndex(newVal); }} variant="fullWidth" sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="Información General" />
          <Tab label={`Detalles (${detallesLocales.length})`} />
          <Tab label={`Anexos (${llamada.anexos?.length || 0})`} />
        </Tabs>

        <Box sx={{ p: { xs: 2, md: 4 } }}>
          
          {tabIndex === 0 && (
            <Grid container spacing={3}>
              <Grid size={{ xs: 12 }}><Typography variant="subtitle2" color="primary">Datos de Origen (Solo Lectura)</Typography><Divider/></Grid>
              <Grid size={{ xs: 12, sm: 6 }}><TextField label="Cliente ID" value={llamada.clienteId} fullWidth disabled size="small" /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}><TextField label="Equipo Afectado" value={llamada.itemIncidenciaId} fullWidth disabled size="small" /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}><TextField label="Número de Serie" value={llamada.nroSerie || 'S/N'} fullWidth disabled size="small" /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}><TextField label="Número de Fabricante" value={llamada.nroFabricante || 'S/N'} fullWidth disabled size="small" /></Grid>

              <Grid size={{ xs: 12 }} sx={{ mt: 2 }}><Typography variant="subtitle2" color="primary">Clasificación {isBorrador ? '(Editable)' : '(Bloqueada)'}</Typography><Divider/></Grid>
              
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField select label="Prioridad" fullWidth size="small" disabled={!isBorrador} value={llamada.prioridad} onChange={(e) => setLlamada({ ...llamada, prioridad: e.target.value })}>
                  <MenuItem value="ALTA">Alta</MenuItem><MenuItem value="MEDIA">Media</MenuItem><MenuItem value="BAJA">Baja</MenuItem>
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField select label="Origen" fullWidth size="small" disabled={!isBorrador} value={llamada.origenLLSId || ''} onChange={(e) => setLlamada({ ...llamada, origenLLSId: Number(e.target.value), tipoProblemaSTId: '', subtipoProblemaSTId: '' })}>
                  {origenes.map(o => <MenuItem key={o.originID} value={o.originID}>{o.name}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField select label="Técnico Asignado" fullWidth size="small" disabled={!isBorrador && !isFT1} value={llamada.tecnicoId || ''} onChange={(e) => setLlamada({ ...llamada, tecnicoId: Number(e.target.value) })}>
                  <MenuItem value=""><em>Sin Asignar</em></MenuItem>
                  {tecnicos.map(t => <MenuItem key={t.empID} value={t.empID}>{t.name}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField select label="Problema" fullWidth size="small" disabled={!isBorrador || !llamada.origenLLSId} value={llamada.tipoProblemaSTId || ''} onChange={(e) => setLlamada({ ...llamada, tipoProblemaSTId: e.target.value, subtipoProblemaSTId: '' })}>
                  {tiposProblema.map(tp => <MenuItem key={tp.id} value={tp.id}>{tp.nombre}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField select label="Sub-Problema (Excluyente)" fullWidth size="small" disabled={!isBorrador || !llamada.origenLLSId} value={llamada.subtipoProblemaSTId || ''} onChange={(e) => setLlamada({ ...llamada, subtipoProblemaSTId: e.target.value })}>
                  {subtiposFiltrados.map(stp => <MenuItem key={stp.id} value={stp.id}>{stp.nombre}</MenuItem>)}
                </TextField>
              </Grid>
            </Grid>
          )}

          {tabIndex === 1 && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {hasManual && currentState === 'T' && (
                    <Button variant="outlined" color="success" startIcon={<ShoppingCartCheckoutIcon />} onClick={() => toast.info("Generar OC SAP (Pendiente)")}>Generar Orden Compra</Button>
                  )}
                  <Button variant="outlined" color="info" startIcon={<SyncIcon />} onClick={() => revalidarStockEnVivo(detallesLocales)} disabled={isCheckingStock || isCerrado}>
                    {isCheckingStock ? 'Verificando...' : 'Refrescar Stock'}
                  </Button>
                </Box>
                <Button variant="contained" startIcon={<AddIcon />} disabled={isCerrado || currentState === 'N'} onClick={() => {
                  setTipoDetalle('REPUESTO'); setNuevoDetalle({ itemDetalleId: '', itemSAP: '', descripcion: '', cantidad: '1', costo: '0', valor: 0, onHandQty: 0 }); setModalDetalleOpen(true);
                }}>
                  Agregar Ítem
                </Button>
              </Box>

              {detallesLocales.length === 0 ? (
                <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}><Typography color="text.secondary">No hay detalles registrados</Typography></Paper>
              ) : isMobile ? (
                <Stack spacing={2}>
                  {detallesLocales.map((d, i) => {
                    const isMissing = d._missingStock; 

                    return (
                      <Card key={i} variant="outlined" sx={{ borderLeft: 6, borderColor: d._missingStock ? 'warning.main' : 'primary.main', bgcolor: d._missingStock ? '#fffdf7' : '#fff' }}>
                        <CardContent sx={{ pb: '16px !important' }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Chip size="small" label={d.tipo} color={d.tipo === 'REPUESTO' ? 'primary' : d.tipo === 'MANUAL' ? 'warning' : 'secondary'} />
                            <Typography variant="body2" fontWeight="bold" color="text.secondary">${d.valor.toFixed(2)} Total</Typography>
                          </Box>
                          <Typography variant="subtitle2" fontWeight="bold" mb={1}>{d.descripcion || d.itemDetalleId}</Typography>
                          
                          <Grid container spacing={1} sx={{ mb: 1 }}>
                            <Grid size={{ xs: 6 }}>
                              <TextField label="Cantidad" size="small" type="number" disabled={isCerrado || currentState === 'N'} value={d.cantidad} onChange={(evt) => handleEditInline(i, 'cantidad', evt.target.value)} fullWidth />
                            </Grid>
                            <Grid size={{ xs: 6 }}>
                              <TextField label="Costo" size="small" type="number" disabled={d.tipo !== 'MANUAL' || isCerrado || currentState === 'N'} value={d.costo} onChange={(evt) => handleEditInline(i, 'costo', evt.target.value)} fullWidth />
                            </Grid>
                          </Grid>

                          {!isCerrado && currentState !== 'N' && (
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                              <IconButton color="error" size="small" onClick={() => handleQuitarDetalle(i)}><DeleteOutlineIcon /></IconButton>
                            </Box>
                          )}

                          {isMissing && !isCerrado && currentState !== 'N' && (
                            <Box sx={{ mt: 2, p: 1.5, bgcolor: '#fff3e0', borderRadius: 1 }}>
                              <Typography variant="body2" color="warning.dark" fontWeight="bold" mb={1}><WarningAmberIcon sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5 }}/> Stock Insuficiente (Hay {d._onHandLimit})</Typography>
                              <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
                                <FormControlLabel control={<Switch color="warning" size="small" disabled={currentState === 'P'} checked={!!d._transferRequested} onChange={(evt) => handleToggleMissingStock(i, 'TRANSFER', evt.target.checked)} />} label={<Typography variant="caption">Traslado {currentState === 'P' ? '(Esperar)' : ''}</Typography>} sx={{ m: 0 }} />
                                <Button size="small" variant="outlined" color="warning" sx={{ fontSize: '0.7rem' }} onClick={() => handleToggleMissingStock(i, 'MANUAL')}>A Manual</Button>
                              </Stack>
                            </Box>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })}
                </Stack>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table>
                    <TableHead sx={{ bgcolor: 'action.hover' }}>
                      <TableRow>
                        <TableCell>Tipo</TableCell>
                        <TableCell>Descripción / Ítem</TableCell>
                        <TableCell align="center" width="160px">Cant.</TableCell>
                        <TableCell align="right" width="160px">Costo</TableCell>
                        <TableCell align="right" width="140px">Valor Total</TableCell>
                        <TableCell align="center">Acción</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {detallesLocales.map((d, i) => {
                        const isMissing = d._missingStock; 

                        return (
                          <React.Fragment key={i}>
                            <TableRow sx={{ bgcolor: d._missingStock ? '#fff3e0' : 'inherit' }}>
                              <TableCell><Chip size="small" label={d.tipo} color={d.tipo === 'REPUESTO' ? 'primary' : d.tipo === 'MANUAL' ? 'warning' : 'secondary'} /></TableCell>
                              <TableCell>{d.descripcion || d.itemDetalleId}</TableCell>
                              
                              <TableCell align="center">
                                <TextField size="small" type="number" disabled={isCerrado || currentState === 'N'} value={d.cantidad} onChange={(evt) => handleEditInline(i, 'cantidad', evt.target.value)} sx={{ minWidth: '90px' }} />
                              </TableCell>
                              
                              <TableCell align="right">
                                <TextField size="small" type="number" disabled={d.tipo !== 'MANUAL' || isCerrado || currentState === 'N'} value={d.costo} onChange={(evt) => handleEditInline(i, 'costo', evt.target.value)} sx={{ minWidth: '90px' }} />
                              </TableCell>
                              
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>${d.valor.toFixed(2)}</TableCell>
                              
                              <TableCell align="center">
                                <IconButton color="error" size="small" disabled={isCerrado || currentState === 'N'} onClick={() => handleQuitarDetalle(i)}><DeleteOutlineIcon /></IconButton>
                              </TableCell>
                            </TableRow>

                            {isMissing && !isCerrado && currentState !== 'N' && (
                              <TableRow sx={{ bgcolor: '#fbfbfb' }}>
                                <TableCell colSpan={6} sx={{ py: 1, borderBottom: '2px solid #e0e0e0' }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, color: 'warning.dark' }}>
                                    <WarningAmberIcon />
                                    <Typography variant="body2" fontWeight="bold">Stock insuficiente (Solo hay {d._onHandLimit}). Opciones:</Typography>
                                    <FormControlLabel control={<Switch color="warning" size="small" disabled={currentState === 'P'} checked={!!d._transferRequested} onChange={(evt) => handleToggleMissingStock(i, 'TRANSFER', evt.target.checked)} />} label={<Typography variant="body2">Solicitar Traslado {currentState === 'P' ? '(Esperar)' : ''}</Typography>} />
                                    <Button size="small" variant="outlined" color="warning" onClick={() => handleToggleMissingStock(i, 'MANUAL')}>Pasar a Manual</Button>
                                  </Box>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        )
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          )}

          {tabIndex === 2 && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 4 }}>
                <Button component="label" variant="contained" startIcon={isUploading ? <CircularProgress size={20} color="inherit" /> : <CloudUploadIcon />} disabled={isUploading || isCerrado || currentState === 'N'} sx={{ px: 4, py: 1.5 }}>
                  {isUploading ? 'Subiendo...' : 'Subir Archivo'}
                  <input type="file" hidden onChange={handleFileUpload} />
                </Button>
              </Box>
              <Grid container spacing={2}>
                {llamada.anexos?.map((anexo) => (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={anexo.id}>
                    <Paper variant="outlined" sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', overflow: 'hidden' }}><InsertDriveFileIcon color="action" sx={{ mr: 1 }} /><Typography variant="body2" noWrap>{anexo.nombre}</Typography></Box>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        {(anexo.url || anexo.ruta) && <IconButton size="small" color="primary" onClick={() => window.open(anexo.url || anexo.ruta, '_blank')}><DownloadIcon /></IconButton>}
                        <IconButton size="small" color="error" disabled={isCerrado || currentState === 'N'} onClick={() => handleDeleteAnexo(anexo.id)}><DeleteOutlineIcon /></IconButton>
                      </Box>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

        </Box>
      </Paper>

      {/* --- BOTONERA ESTRATÉGICA (Oculta si está CERRADA) --- */}
      {!isCerrado && (
        <Paper sx={{ mt: 3, p: 3, borderRadius: 2, display: 'flex', justifyContent: 'flex-end', gap: 2, bgcolor: 'background.default' }}>
          
          {currentState !== 'N' && (
            <Button variant="outlined" startIcon={isSubmitting ? <CircularProgress size={20} /> : <SaveIcon />} onClick={() => handleAccionPrincipal('ACTUALIZAR')} disabled={isSubmitting}>
              Guardar Cambios
            </Button>
          )}

          {/* Flujo 1: Técnico (No FT1) envía a autorizar */}
          {currentState === 'P' && !isFT1 && (
             (llamada.nroInterno || 0) > 0 ? (
               <Button variant="contained" color="success" disabled startIcon={<CheckCircleIcon />}>
                 Esperando Autorización (Enviado a SAP)
               </Button>
             ) : (
               <Button variant="contained" color="success" startIcon={<SendIcon />} onClick={() => handleAccionPrincipal('ENVIAR_AUTORIZAR')} disabled={isSubmitting}>
                 Enviar a Autorizar (SAP)
               </Button>
             )
          )}

          {/* Flujo 2: FT1 revisa orden de OTRO técnico en su bandeja */}
          {currentState === 'P' && isFT1 && !isOwnOrder && (
            <>
              <Button variant="contained" color="error" startIcon={<CancelIcon />} onClick={() => handleAccionPrincipal('NEGAR')} disabled={isSubmitting}>
                Negar (N)
              </Button>
              <Button variant="contained" color="success" startIcon={<CheckCircleIcon />} onClick={() => handleAccionPrincipal('AUTORIZAR')} disabled={isSubmitting}>
                Autorizar (A)
              </Button>
            </>
          )}

          {/* Flujo 3: FT1 procesa SU PROPIA orden (Brinca estado A) */}
          {currentState === 'P' && isFT1 && isOwnOrder && (
            <Button variant="contained" color="primary" startIcon={<PlayArrowIcon />} onClick={() => handleIntentoAbrir('ABRIR_DIRECTO')} disabled={isSubmitting}>
              Pasar a Abierto (T)
            </Button>
          )}

          {/* Flujo 4: Técnico/FT1 Post-Autorización */}
          {currentState === 'A' && (
            <>
              {hasTransfers ? (
                <Button variant="contained" color="warning" startIcon={<LocalShippingIcon />} onClick={() => setTransferModalOpen(true)} disabled={isSubmitting}>
                  Enviar Solicitud de Traslado (S)
                </Button>
              ) : hasMissingStock ? (
                <Button variant="contained" color="warning" disabled>Resuelve el Stock Faltante</Button>
              ) : (
                <Button variant="contained" color="primary" startIcon={<PlayArrowIcon />} onClick={() => handleIntentoAbrir('ABRIR')} disabled={isSubmitting}>
                  Pasar a Abierto (T)
                </Button>
              )}
            </>
          )}

          {/* Flujo Extra: Transición desde S (Pendiente de Stock) hacia T (Abierto) */}
          {currentState === 'S' && (
            <>
              {hasMissingStock ? (
                <Button variant="contained" color="warning" disabled>
                  Esperando Stock Faltante...
                </Button>
              ) : (
                <Button variant="contained" color="primary" startIcon={<PlayArrowIcon />} onClick={() => handleAccionPrincipal('ABRIR_DESDE_S')} disabled={isSubmitting}>
                  Stock Completo: Pasar a Abierto (T)
                </Button>
              )}
            </>
          )}

          {/* 🚨 Flujo 5: CIERRE (Abre Modal de Soluciones) */}
          {currentState === 'T' && (
            <Button variant="contained" color="error" startIcon={<TaskAltIcon />} onClick={handleOpenCloseModal} disabled={isSubmitting}>
              Finalizar y Cerrar Orden (C)
            </Button>
          )}
        </Paper>
      )}

      {/* --- MODALES --- */}
      <Dialog open={modalDetalleOpen} onClose={() => setModalDetalleOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>Agregar Ítem</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12 }}>
              <TextField select label="Tipo" fullWidth size="small" value={tipoDetalle} onChange={(evt) => { setTipoDetalle(evt.target.value); setOpcionesBusqueda([]); setNuevoDetalle({ itemDetalleId: '', itemSAP: '', descripcion: '', cantidad: '1', costo: '0', valor: 0, onHandQty: 0 }); }}>
                <MenuItem value="REPUESTO">Repuesto (Inventario)</MenuItem>
                <MenuItem value="MANO_OBRA">Mano de Obra</MenuItem>
                <MenuItem value="MANUAL">Ítem Manual (Compra Local)</MenuItem>
              </TextField>
            </Grid>

            {tipoDetalle !== 'MANUAL' ? (
              <Grid size={{ xs: 12 }}>
                <Autocomplete
                  options={opcionesBusqueda}
                  getOptionLabel={(opt) => isRepuesto(opt) ? `${opt.itemCode} - ${opt.itemName}` : `${(opt as ManoObraOption).code} - ${(opt as ManoObraOption).name}`}
                  onInputChange={(evt, val) => { evt?.stopPropagation(); buscarItems(val); }}
                  onChange={(evt, val) => {
                    evt?.stopPropagation();
                    if (val) {
                      if (isRepuesto(val)) setNuevoDetalle({ ...nuevoDetalle, itemDetalleId: val.itemCode, itemSAP: val.itemCode, descripcion: val.itemName, costo: val.avgPrice.toString(), onHandQty: val.onHandQty });
                      else setNuevoDetalle({ ...nuevoDetalle, itemDetalleId: val.code, itemSAP: val.u_NA_ITEM, descripcion: val.name, costo: val.u_NA_VALOR.toString(), onHandQty: 999 });
                    }
                  }}
                  loading={isBuscando}
                  renderInput={(params) => <TextField {...params} label="Buscar Ítem" size="small" />}
                />
              </Grid>
            ) : (
              <Grid size={{ xs: 12 }}><TextField label="Descripción" fullWidth size="small" value={nuevoDetalle.descripcion} onChange={(evt) => setNuevoDetalle({...nuevoDetalle, descripcion: evt.target.value})} /></Grid>
            )}

            <Grid size={{ xs: 6 }}><TextField label="Cantidad" type="number" fullWidth size="small" value={nuevoDetalle.cantidad} onChange={(evt) => setNuevoDetalle({...nuevoDetalle, cantidad: evt.target.value})} /></Grid>
            <Grid size={{ xs: 6 }}><TextField label="Costo ($)" type="number" fullWidth size="small" disabled={tipoDetalle !== 'MANUAL'} value={nuevoDetalle.costo} onChange={(evt) => setNuevoDetalle({...nuevoDetalle, costo: evt.target.value})} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setModalDetalleOpen(false)}>Cancelar</Button>
          <Button onClick={handleAgregarDetalle} variant="contained" startIcon={<AddIcon />}>Agregar a la Lista</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={transferModalOpen} onClose={() => setTransferModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold', color: 'warning.dark' }}><LocalShippingIcon sx={{ verticalAlign: 'middle', mr: 1 }} /> Solicitar Traslado</DialogTitle>
        <DialogContent dividers>
          <Typography mb={2}>Por favor, ingresa un comentario para la bodega central que justifique este traslado de repuestos faltantes.</Typography>
          <TextField fullWidth multiline rows={3} label="Comentarios" value={transferComments} onChange={(e) => setTransferComments(e.target.value)} placeholder="Ej. Necesitamos este repuesto con urgencia para la máquina X..." />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setTransferModalOpen(false)} color="inherit">Cancelar</Button>
          <Button onClick={() => handleAccionPrincipal('TRASLADO')} variant="contained" color="warning" disabled={isSubmitting}>
            {isSubmitting ? 'Enviando...' : 'Confirmar y Enviar Solicitud'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 🚨 MODAL DE SOLUCIONES (CIERRE DE OS) */}
      <Dialog open={closeModalOpen} onClose={() => setCloseModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold', color: 'error.main', display: 'flex', alignItems: 'center', gap: 1 }}>
          <TaskAltIcon /> Finalizar Orden (Base de Conocimiento)
        </DialogTitle>
        <DialogContent dividers>
          {isLoadingSolutions ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
          ) : (
            <Grid container spacing={2}>
              <Grid size={{ xs: 12 }}>
                <Typography variant="body2" color="text.secondary" mb={2}>
                  Para cerrar la orden, debes documentar la solución aplicada al equipo. Esto ayudará a otros técnicos en el futuro.
                </Typography>
              </Grid>

              <Grid size={{ xs: 12, sm: 8 }}>
                {isNewSolucion ? (
                  <TextField 
                    label="Describa la Solución Aplicada" fullWidth size="small" autoFocus required
                    value={nuevaSolucion.solucion} onChange={(e) => setNuevaSolucion({ ...nuevaSolucion, solucion: e.target.value })} 
                  />
                ) : (
                  <Autocomplete
                    options={solucionesOpciones}
                    getOptionLabel={(opt) => `${opt.solucion} (Causa: ${opt.causa})`}
                    onInputChange={(_, newInputValue) => buscarSoluciones(newInputValue)}
                    onChange={(_, newValue) => setSolucionSeleccionada(newValue)}
                    loading={isBuscandoSoluciones}
                    renderInput={(params) => <TextField {...params} label="Buscar Solución Existente" size="small" />}
                  />
                )}
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }} sx={{ display: 'flex', alignItems: 'center' }}>
                <FormControlLabel control={<Switch checked={isNewSolucion} onChange={(e) => setIsNewSolucion(e.target.checked)} color="primary" />} label="Crear Nueva" />
              </Grid>

              {isNewSolucion && (
                <>
                  <Grid size={{ xs: 12 }}>
                    <TextField label="Causa Raíz del Problema" fullWidth size="small" required value={nuevaSolucion.causa} onChange={(e) => setNuevaSolucion({ ...nuevaSolucion, causa: e.target.value })} />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField label="Equipo" fullWidth size="small" disabled value={`${nuevaSolucion.item} - ${nuevaSolucion.descripcion}`} />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField label="Síntoma (Motivo)" fullWidth size="small" value={nuevaSolucion.sintoma} onChange={(e) => setNuevaSolucion({ ...nuevaSolucion, sintoma: e.target.value })} />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField label="Comentarios Opcionales" fullWidth multiline rows={2} size="small" value={nuevaSolucion.comentarios} onChange={(e) => setNuevaSolucion({ ...nuevaSolucion, comentarios: e.target.value })} />
                  </Grid>
                </>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setCloseModalOpen(false)} color="inherit">Cancelar</Button>
          <Button onClick={confirmCloseOS} variant="contained" color="error" disabled={isSubmitting || isLoadingSolutions}>
            Confirmar Cierre de Orden
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
};