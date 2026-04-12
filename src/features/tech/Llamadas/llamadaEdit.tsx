import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, TextField, Button, MenuItem, CircularProgress,
  IconButton, Avatar, Tabs, Tab, TableContainer, Table, TableHead,
  TableRow, TableCell, TableBody, Dialog, DialogTitle, DialogContent, DialogActions,
  Autocomplete, Chip, Alert, Switch, FormControlLabel
} from '@mui/material';
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

// 🚨 NUEVO HELPER: Obtiene la hora ISO exacta local (Ecuador) sin sumarle las 5 horas del UTC.
const getLocalISOString = () => {
  const date = new Date();
  const tzoffset = date.getTimezoneOffset() * 60000; // Offset en milisegundos (Aprox 5 horas)
  return new Date(date.getTime() - tzoffset).toISOString().slice(0, -1) + 'Z'; 
};

export const LlamadaEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAppSelector(selectCurrentUser);
  const isFT1 = user?.ubicacion === '05-FT1';

  const [llamada, setLlamada] = useState<LlamadaServicio | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tabIndex, setTabIndex] = useState(0);

  const [detallesLocales, setDetallesLocales] = useState<LlamadaDetalleUI[]>([]);

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

  useEffect(() => {
    const fetchLlamada = async () => {
      if (!id) return;
      try {
        const res = await api.get<LlamadaServicio>(TECH_ENDPOINTS.GET_LLAMADA_BY_ID(id));
        setLlamada(res.data);
        setDetallesLocales((res.data.detalles || []) as LlamadaDetalleUI[]);
      } catch (err) {
        console.error(err);
        toast.error("Error al cargar la orden de servicio");
        navigate('/tech/llamadas');
      } finally {
        setIsLoading(false);
      }
    };
    fetchLlamada();
  }, [id, navigate]);

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
    
    const qty = Number(nuevoDetalle.cantidad) || 0;
    const cst = Number(nuevoDetalle.costo) || 0;

    const baseDetalle: LlamadaDetalleUI = {
      id: 0, llamadaServicioId: Number(id), tipo: tipoDetalle,
      cantidad: qty, costo: cst, valor: qty * cst,
      descripcion: nuevoDetalle.descripcion,
      usuFechaCrea: getLocalISOString() // 🚨 Usando hora local Ecuador
    };

    if (tipoDetalle !== 'MANUAL') {
       baseDetalle.itemDetalleId = nuevoDetalle.itemDetalleId;
       baseDetalle.itemSAP = nuevoDetalle.itemSAP;
    }

    if (tipoDetalle === 'REPUESTO' && qty > nuevoDetalle.onHandQty) {
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

  const handleAccionPrincipal = async (accion: 'ACTUALIZAR' | 'TRASLADO' | 'ABRIR' | 'CERRAR' | 'AUTORIZAR' | 'NEGAR') => {
    if (!llamada || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const fechaActual = getLocalISOString(); // 🚨 Usando hora local Ecuador

      const detallesLimpios = detallesLocales.map(d => {
        const det: Partial<OriginalLlamadaDetalle> = {
          llamadaServicioId: d.llamadaServicioId, tipo: d.tipo, descripcion: d.descripcion,
          cantidad: Number(d.cantidad) || 0, 
          costo: Number(d.costo) || 0, 
          valor: d.valor,
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

      if (accion === 'AUTORIZAR') {
        toast.info("1/3: Autorizando en SQL...");
        await api.patch(TECH_ENDPOINTS.PATCH_LLAMADA_ESTADO(llamada.id), { estado: 'A' });
        
        toast.info("2/3: Registrando orden en SAP...");
        await api.post(TECH_ENDPOINTS.POST_SAP_LLAMADA(llamada.id), {});
        
        toast.info("3/3: Autorizando estado en SAP...");
        await api.patch(TECH_ENDPOINTS.PATCH_SAP_LLAMADA_ESTADO(llamada.id), { estado: 'A' });
        
        toast.success("¡Orden Autorizada y Sincronizada!");
        navigate('/tech/llamadas/aprobaciones');
        return;
      }
      else if (accion === 'NEGAR') {
        toast.info("Negando orden...");
        await api.patch(TECH_ENDPOINTS.PATCH_LLAMADA_ESTADO(llamada.id), { estado: 'N' });
        toast.success("Orden Negada.");
        navigate('/tech/llamadas/aprobaciones'); 
        return;
      }
      
      else if (accion === 'TRASLADO') {
        const detallesSQL = detallesLocales
          .filter(d => d._transferRequested)
          .map(d => {
            const limit = d._onHandLimit || 0;
            const missing = (Number(d.cantidad) || 0) - limit;
            return { 
              item: (d.itemSAP || d.itemDetalleId || '').toString(), 
              descripcion: d.descripcion || '',
              cantidadSolicitada: missing > 0 ? missing : 1,
              cantidadEntregada: 0
            };
          });

        const trasladoSQLPayload = {
          nroInterno: 0, nroDocumento: 0, fecha: fechaActual, 
          bodegaDesde: "05", ubicacionDesde: "05-FT1",
          bodegaHasta: user?.idbranch || '', ubicacionHasta: user?.ubicacion || '',
          estado: "P", nroServicio: llamada.id.toString(), 
          clienteId: user?.codigocliente || '',
          comentarios: transferComments, detalles: detallesSQL
        };

        toast.info("1/5: Registrando Solicitud en SQL...");
        const sqlRes = await api.post('/solicitudes-transferencia', trasladoSQLPayload);
        const nuevaSolicitudId = (typeof sqlRes.data === 'object' && sqlRes.data.id) ? sqlRes.data.id : sqlRes.data;

        const detallesSAP = detallesLocales
          .filter(d => d._transferRequested)
          .map(d => {
            const limit = d._onHandLimit || 0;
            const missing = (Number(d.cantidad) || 0) - limit;
            return { itemCode: (d.itemSAP || d.itemDetalleId || '').toString(), quantity: missing > 0 ? missing : 1 };
          });

        const trasladoSAPPayload = {
          solicitudTransferenciaId: Number(nuevaSolicitudId), fecha: fechaActual, 
          bodegaDesde: "05", ubicacionDesde: "05-FT1",
          bodegaHasta: user?.idbranch || '', ubicacionHasta: user?.ubicacion || '',
          estado: "P", nroServicio: llamada.id.toString(), 
          clienteId: user?.codigocliente || '',
          comentarios: transferComments, detalles: detallesSAP
        };

        toast.info("2/5: Enviando Solicitud a SAP...");
        await api.post(TECH_ENDPOINTS.POST_SAP_TRASLADO, trasladoSAPPayload);
        
        toast.info("3/5: Guardando orden en SQL...");
        await api.put(TECH_ENDPOINTS.PUT_LLAMADA(llamada.id), payloadSQL);
        
        toast.info("4/5: Sincronizando con SAP...");
        await api.put(TECH_ENDPOINTS.PUT_SAP_LLAMADA(llamada.id), {}); 
        
        toast.info("5/5: Cambiando estados a 'S'...");
        await api.patch(TECH_ENDPOINTS.PATCH_LLAMADA_ESTADO(llamada.id), { estado: 'S' });
        await api.patch(TECH_ENDPOINTS.PATCH_SAP_LLAMADA_ESTADO(llamada.id), { estado: 'S' });
        
        setTransferModalOpen(false);
        setLlamada({ ...llamada, estado: 'S', usuFechaModifica: fechaActual, detalles: detallesLimpios });
        toast.success("¡Traslado solicitado y orden actualizada (Estado: S)!");
      }
      
      else if (accion === 'ABRIR') {
        toast.info("1/3: Guardando orden en SQL...");
        await api.put(TECH_ENDPOINTS.PUT_LLAMADA(llamada.id), payloadSQL);
        toast.info("2/3: Sincronizando con SAP...");
        await api.put(TECH_ENDPOINTS.PUT_SAP_LLAMADA(llamada.id), {});
        toast.info("3/3: Abriendo orden (Estado T)...");
        await api.patch(TECH_ENDPOINTS.PATCH_LLAMADA_ESTADO(llamada.id), { estado: 'T' });
        await api.patch(TECH_ENDPOINTS.PATCH_SAP_LLAMADA_ESTADO(llamada.id), { estado: 'T' });
        setLlamada({ ...llamada, estado: 'T', usuFechaModifica: fechaActual, detalles: detallesLimpios });
        toast.success("¡Orden Abierta y lista para procesar (Estado: T)!");
      }
      
      else if (accion === 'CERRAR') {
        toast.info("1/3: Guardando cambios finales en SQL...");
        await api.put(TECH_ENDPOINTS.PUT_LLAMADA(llamada.id), payloadSQL);
        toast.info("2/3: Sincronizando con SAP...");
        await api.put(TECH_ENDPOINTS.PUT_SAP_LLAMADA(llamada.id), {});
        toast.info("3/3: Cerrando orden (Estado C)...");
        await api.patch(TECH_ENDPOINTS.PATCH_LLAMADA_ESTADO(llamada.id), { estado: 'C' });
        await api.patch(TECH_ENDPOINTS.PATCH_SAP_LLAMADA_ESTADO(llamada.id), { estado: 'C' });
        setLlamada({ ...llamada, estado: 'C', usuFechaModifica: fechaActual, detalles: detallesLimpios });
        toast.success("¡Orden Cerrada con éxito (Estado: C)!");
      }
      
      else if (accion === 'ACTUALIZAR') {
        await api.put(TECH_ENDPOINTS.PUT_LLAMADA(llamada.id), payloadSQL);
        if (llamada.estado !== 'P' && llamada.estado !== 'A') {
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


  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 10 }}><CircularProgress /></Box>;
  if (!llamada) return <Typography align="center" mt={5}>Orden no encontrada</Typography>;

  const currentState = llamada.estado;
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
            <Typography variant="body2" color="text.secondary">Cliente: {llamada.clienteId} | Fecha: {llamada.fecha.split('T')[0]}</Typography>
          </Box>
        </Box>
        <Chip label={`ESTADO: ${renderEstadoLabel(currentState)}`} color={currentState === 'C' ? 'default' : currentState === 'T' ? 'success' : currentState === 'N' ? 'error' : 'primary'} sx={{ fontWeight: 'bold', px: 2, py: 2, fontSize: '1rem' }} />
      </Box>

      {hasTransfers && currentState === 'A' && (
        <Alert severity="warning" sx={{ mb: 3, fontWeight: 'bold' }}>
          Existen ítems marcados para Solicitud de Traslado. Asegúrate de enviar la solicitud antes de procesar la orden.
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
              <Grid size={{ xs: 12, sm: 6 }}><TextField label="Equipo Afectado" value={llamada.itemIncidenciaId} fullWidth disabled /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}><TextField label="Prioridad" value={llamada.prioridad || 'N/A'} fullWidth disabled /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}><TextField label="Número de Serie" value={llamada.nroSerie || 'S/N'} fullWidth disabled /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}><TextField label="Número de Fabricante" value={llamada.nroFabricante || 'S/N'} fullWidth disabled /></Grid>
            </Grid>
          )}

          {tabIndex === 1 && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                {hasManual && currentState === 'T' ? (
                  <Button variant="outlined" color="success" startIcon={<ShoppingCartCheckoutIcon />} onClick={() => toast.info("Generar OC SAP (Pendiente)")}>Generar Orden Compra</Button>
                ) : <Box />}
                <Button variant="contained" startIcon={<AddIcon />} disabled={currentState === 'C' || currentState === 'N'} onClick={() => {
                  setTipoDetalle('REPUESTO'); setNuevoDetalle({ itemDetalleId: '', itemSAP: '', descripcion: '', cantidad: '1', costo: '0', valor: 0, onHandQty: 0 }); setModalDetalleOpen(true);
                }}>
                  Agregar Ítem
                </Button>
              </Box>

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
                    {detallesLocales.length === 0 ? (
                      <TableRow><TableCell colSpan={6} align="center">No hay detalles registrados</TableCell></TableRow>
                    ) : (
                      detallesLocales.map((d, i) => {
                        const isRepuestoEnA = d.tipo === 'REPUESTO' && currentState === 'A';
                        const isMissing = d._missingStock || isRepuestoEnA;

                        return (
                          <React.Fragment key={i}>
                            <TableRow sx={{ bgcolor: d._missingStock ? '#fff3e0' : 'inherit' }}>
                              <TableCell><Chip size="small" label={d.tipo} color={d.tipo === 'REPUESTO' ? 'primary' : d.tipo === 'MANUAL' ? 'warning' : 'secondary'} /></TableCell>
                              <TableCell>{d.descripcion || d.itemDetalleId}</TableCell>
                              
                              <TableCell align="center">
                                <TextField 
                                  size="small" type="number" 
                                  disabled={currentState === 'C' || currentState === 'N'} 
                                  value={d.cantidad} 
                                  onChange={(evt) => handleEditInline(i, 'cantidad', evt.target.value)} 
                                  sx={{ minWidth: '90px' }} 
                                />
                              </TableCell>
                              
                              <TableCell align="right">
                                <TextField 
                                  size="small" type="number" 
                                  disabled={d.tipo !== 'MANUAL' || currentState === 'C' || currentState === 'N'} 
                                  value={d.costo} 
                                  onChange={(evt) => handleEditInline(i, 'costo', evt.target.value)} 
                                  sx={{ minWidth: '90px' }} 
                                />
                              </TableCell>
                              
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>${d.valor.toFixed(2)}</TableCell>
                              
                              <TableCell align="center">
                                <IconButton color="error" size="small" disabled={currentState === 'C' || currentState === 'N'} onClick={() => handleQuitarDetalle(i)}><DeleteOutlineIcon /></IconButton>
                              </TableCell>
                            </TableRow>

                            {isMissing && currentState !== 'C' && currentState !== 'N' && (
                              <TableRow sx={{ bgcolor: '#fbfbfb' }}>
                                <TableCell colSpan={6} sx={{ py: 1, borderBottom: '2px solid #e0e0e0' }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, color: d._missingStock ? 'warning.dark' : 'text.secondary' }}>
                                    {d._missingStock && <WarningAmberIcon />}
                                    <Typography variant="body2" fontWeight="bold">
                                      {d._missingStock ? `Stock insuficiente (Solo hay ${d._onHandLimit}).` : 'Opciones de Abastecimiento:'}
                                    </Typography>
                                    <FormControlLabel control={<Switch color="warning" size="small" checked={!!d._transferRequested} onChange={(evt) => handleToggleMissingStock(i, 'TRANSFER', evt.target.checked)} />} label={<Typography variant="body2">Solicitar Transferencia</Typography>} />
                                    {d._missingStock && <Button size="small" variant="outlined" color="warning" onClick={() => handleToggleMissingStock(i, 'MANUAL')}>Pasar a Manual</Button>}
                                  </Box>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {tabIndex === 2 && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 4 }}>
                <Button component="label" variant="contained" startIcon={isUploading ? <CircularProgress size={20} color="inherit" /> : <CloudUploadIcon />} disabled={isUploading || currentState === 'C' || currentState === 'N'} sx={{ px: 4, py: 1.5 }}>
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
                        {(anexo.url || anexo.ruta) && (
                          <IconButton size="small" color="primary" onClick={() => window.open(anexo.url || anexo.ruta, '_blank')}><DownloadIcon /></IconButton>
                        )}
                        <IconButton size="small" color="error" disabled={currentState === 'C' || currentState === 'N'} onClick={() => handleDeleteAnexo(anexo.id)}><DeleteOutlineIcon /></IconButton>
                      </Box>

                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

        </Box>
      </Paper>

      <Paper sx={{ mt: 3, p: 3, borderRadius: 2, display: 'flex', justifyContent: 'flex-end', gap: 2, bgcolor: 'background.default' }}>
        
        {currentState !== 'C' && currentState !== 'N' && (
          <Button variant="outlined" startIcon={isSubmitting ? <CircularProgress size={20} /> : <SaveIcon />} onClick={() => handleAccionPrincipal('ACTUALIZAR')} disabled={isSubmitting}>
            Actualizar (Solo Guardar)
          </Button>
        )}

        {currentState === 'P' && isFT1 && (
          <>
            <Button variant="contained" color="error" startIcon={<CancelIcon />} onClick={() => handleAccionPrincipal('NEGAR')} disabled={isSubmitting}>
              Negar (N)
            </Button>
            <Button variant="contained" color="success" startIcon={<CheckCircleIcon />} onClick={() => handleAccionPrincipal('AUTORIZAR')} disabled={isSubmitting}>
              Autorizar (A)
            </Button>
          </>
        )}

        {currentState === 'A' && (
          <>
            {hasTransfers ? (
              <Button variant="contained" color="warning" startIcon={<LocalShippingIcon />} onClick={() => setTransferModalOpen(true)} disabled={isSubmitting}>
                Enviar Solicitud de Traslado (S)
              </Button>
            ) : hasMissingStock ? (
              <Button variant="contained" color="warning" disabled>Resuelve el Stock Faltante</Button>
            ) : (
              <Button variant="contained" color="primary" startIcon={<PlayArrowIcon />} onClick={() => handleAccionPrincipal('ABRIR')} disabled={isSubmitting}>
                Pasar a Abierto (T)
              </Button>
            )}
          </>
        )}

        {currentState === 'T' && (
          <Button variant="contained" color="error" startIcon={<CheckCircleIcon />} onClick={() => handleAccionPrincipal('CERRAR')} disabled={isSubmitting}>
            Cerrar Orden (C)
          </Button>
        )}
      </Paper>

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

    </Box>
  );
};