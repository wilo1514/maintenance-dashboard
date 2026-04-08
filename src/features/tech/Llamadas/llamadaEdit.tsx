import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, TextField, Button, MenuItem, CircularProgress,
  IconButton, Avatar, Tabs, Tab, TableContainer, Table, TableHead,
  TableRow, TableCell, TableBody, Dialog, DialogTitle, DialogContent, DialogActions,
  Autocomplete, Chip, Alert
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
import PlayCircleFilledWhiteIcon from '@mui/icons-material/PlayCircleFilledWhite';

import { useAppSelector } from '../../../app/hooks';
import { selectCurrentUser } from '../../auth/authSlice';
import api from '../../../services/api';
import { TECH_ENDPOINTS } from '../../../services/endpoints/tech';
import { type LlamadaServicio, type LlamadaAnexo, type LlamadaDetalle } from './llamadasSlice';

// --- INTERFACES ESTRICTAS (CERO ANY) ---
interface RepuestoOption { itemCode: string; itemName: string; onHandQty: number; }
interface ManoObraOption { code: string; name: string; u_NA_VALOR: number; }
type BusquedaOption = RepuestoOption | ManoObraOption;

// Solo necesitamos este Type Guard para saber si es repuesto
const isRepuesto = (opt: BusquedaOption): opt is RepuestoOption => 'itemCode' in opt;

export const LlamadaEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAppSelector(selectCurrentUser);

  const [llamada, setLlamada] = useState<LlamadaServicio | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tabIndex, setTabIndex] = useState(0);

  // --- ESTADOS DE DETALLES LOCALES ---
  const [detallesLocales, setDetallesLocales] = useState<LlamadaDetalle[]>([]);
  const [needsTransfer, setNeedsTransfer] = useState(false);

  // --- ESTADOS PARA MODAL DE DETALLES ---
  const [modalDetalleOpen, setModalDetalleOpen] = useState(false);
  const [tipoDetalle, setTipoDetalle] = useState('REPUESTO'); 
  const [opcionesBusqueda, setOpcionesBusqueda] = useState<BusquedaOption[]>([]);
  const [isBuscando, setIsBuscando] = useState(false);

  const [nuevoDetalle, setNuevoDetalle] = useState({
    itemDetalleId: '',
    descripcion: '',
    cantidad: 1,
    costo: 0,
    valor: 0,
    onHandQty: 0
  });

  // --- ESTADOS PARA ALERTA DE STOCK INSUFICIENTE ---
  const [stockWarningOpen, setStockWarningOpen] = useState(false);
  const [detallePendiente, setDetallePendiente] = useState<LlamadaDetalle | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. CARGAR ORDEN DE SERVICIO
  useEffect(() => {
    const fetchLlamada = async () => {
      if (!id) return;
      try {
        const res = await api.get<LlamadaServicio>(TECH_ENDPOINTS.GET_LLAMADA_BY_ID(id));
        setLlamada(res.data);
        setDetallesLocales(res.data.detalles || []);
      } catch (error) {
        toast.error("Error al cargar la orden de servicio" + error);
        navigate('/tech/llamadas');
      } finally {
        setIsLoading(false);
      }
    };
    fetchLlamada();
  }, [id, navigate]);

  // --- ANEXOS ---
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !id) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('id', id);
    formData.append('archivo', file);

    try {
      const res = await api.post<LlamadaAnexo[]>(TECH_ENDPOINTS.POST_LLAMADA_ANEXO, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setLlamada(prev => prev ? { ...prev, anexos: res.data } : null);
      toast.success("Archivo subido correctamente");
    } catch (error) {
      toast.error("Error al subir el archivo" + error);
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const handleDeleteAnexo = async (anexoId: number) => {
    if (!id) return;
    try {
      await api.delete(TECH_ENDPOINTS.DELETE_LLAMADA_ANEXO(id, anexoId));
      setLlamada(prev => prev ? { ...prev, anexos: prev.anexos.filter(a => a.id !== anexoId) } : null);
      toast.info("Anexo eliminado");
    } catch (error) {
      toast.error("Error al eliminar anexo" + error);
    }
  };

  // --- BÚSQUEDA DE CATÁLOGOS ---
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
    } catch (error) {
      console.error(error);
    } finally {
      setIsBuscando(false);
    }
  };

  // --- LÓGICA DE AGREGAR DETALLES ---
  const handleIntentarAgregarDetalle = () => {
    if (tipoDetalle !== 'MANUAL' && !nuevoDetalle.itemDetalleId) {
      return toast.warning("Selecciona un ítem válido");
    }

    const baseDetalle = {
      tipo: tipoDetalle,
      itemDetalleId: tipoDetalle === 'MANUAL' ? nuevoDetalle.descripcion : nuevoDetalle.itemDetalleId,
      cantidad: Number(nuevoDetalle.cantidad),
      costo: Number(nuevoDetalle.costo),
      valor: Number(nuevoDetalle.valor),
      llamadaServicioId: Number(id)
    } as LlamadaDetalle;

    if (tipoDetalle === 'REPUESTO' && baseDetalle.cantidad > nuevoDetalle.onHandQty) {
      setDetallePendiente(baseDetalle);
      setStockWarningOpen(true);
      return; 
    }

    agregarAlEstadoLocal(baseDetalle);
  };

  const agregarAlEstadoLocal = (detalle: LlamadaDetalle) => {
    setDetallesLocales(prev => [...prev, detalle]);
    toast.success("Detalle agregado a la lista (Recuerda Actualizar)");
    setModalDetalleOpen(false);
    setNuevoDetalle({ itemDetalleId: '', descripcion: '', cantidad: 1, costo: 0, valor: 0, onHandQty: 0 });
  };

  const handleQuitarDetalle = (indexToRemove: number) => {
    setDetallesLocales(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // --- ACCIONES DEL MODAL DE STOCK INSUFICIENTE ---
  const handleOpcionTransferencia = () => {
    if (!detallePendiente) return;
    setNeedsTransfer(true);
    agregarAlEstadoLocal(detallePendiente);
    setStockWarningOpen(false);
    toast.info("Ítem marcado para Solicitud de Transferencia");
  };

  const handleOpcionCompraLocal = () => {
    if (!detallePendiente) return;
    setTipoDetalle('MANUAL');
    setNuevoDetalle(prev => ({
      ...prev,
      descripcion: `(Compra Local) ${detallePendiente.itemDetalleId}`,
      itemDetalleId: '',
      costo: 0,
      valor: 0
    }));
    setStockWarningOpen(false);
    toast.info("Ingresa el costo y valor manual del repuesto.");
  };

  // --- BOTONES PRINCIPALES (PUT MASIVO) ---
  const executeUpdateOrder = async (targetState: string) => {
    if (!llamada) return;
    setIsSubmitting(true);

    try {
      const detallesLimpios = detallesLocales.map(d => {
        const detalleParaEnviar: Partial<LlamadaDetalle> = {
          llamadaServicioId: d.llamadaServicioId,
          tipo: d.tipo,
          itemDetalleId: d.itemDetalleId,
          cantidad: d.cantidad,
          costo: d.costo,
          valor: d.valor,
        };

        if (d.id && d.id !== 0) {
          detalleParaEnviar.id = d.id;
        }

        return detalleParaEnviar;
      });

      // 🚨 INYECCIÓN DE LA FECHA DE MODIFICACIÓN 🚨
      const payload = {
        ...llamada,
        estado: targetState,
        usuFechaModifica: new Date().toISOString(), // <-- Fecha y hora actual del navegador
        detalles: detallesLimpios
      };

      await api.put(TECH_ENDPOINTS.PUT_LLAMADA(llamada.id), payload);
      
      // Actualizamos el estado local para que no haya desincronización
      setLlamada({ 
        ...llamada, 
        estado: targetState, 
        usuFechaModifica: payload.usuFechaModifica, 
        detalles: detallesLocales 
      });
      
      if (targetState === 'PROCESO') {
        toast.success("¡Orden enviada a PROCESO!");
      } else {
        toast.success(`Orden Actualizada (Estado: ${targetState})`);
      }
    } catch (error) {
      toast.error("Error al actualizar la orden" + error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBotonActualizar = () => {
    const estadoFinal = needsTransfer ? 'STOCK PENDIENTE' : 'AUTORIZAR';
    executeUpdateOrder(estadoFinal);
  };

  const handleBotonProceso = () => {
    executeUpdateOrder('PROCESO');
  };

  const handleGenerarOferta = () => {
    toast.info("Endpoint de Oferta de Compra en construcción...");
  };

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 10 }}><CircularProgress /></Box>;
  if (!llamada) return <Typography align="center" mt={5}>Orden no encontrada</Typography>;

  const hasManualDetails = detallesLocales.some(d => d.tipo === 'MANUAL');

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
        <Chip 
          label={`ESTADO: ${llamada.estado}`} 
          color={llamada.estado === 'P' ? 'warning' : 'primary'} 
          sx={{ fontWeight: 'bold', px: 2, py: 2, fontSize: '1rem' }} 
        />
      </Box>

      {needsTransfer && (
        <Alert severity="warning" sx={{ mb: 3, fontWeight: 'bold' }}>
          Existen ítems con stock insuficiente marcados para Solicitud de Transferencia. Al actualizar, el estado pasará a STOCK PENDIENTE.
        </Alert>
      )}

      <Paper sx={{ borderRadius: 2 }}>
        <Tabs value={tabIndex} onChange={(_, newVal) => setTabIndex(newVal)} variant="fullWidth" sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="Información General" />
          <Tab label={`Detalles Locales (${detallesLocales.length})`} />
          <Tab label={`Anexos (${llamada.anexos?.length || 0})`} />
        </Tabs>

        <Box sx={{ p: { xs: 2, md: 4 } }}>
          
          {tabIndex === 0 && (
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField label="Equipo Afectado" value={llamada.itemIncidenciaId} fullWidth disabled />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField label="Prioridad" value={llamada.prioridad || 'N/A'} fullWidth disabled />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField label="Número de Serie" value={llamada.nroSerie || 'S/N'} fullWidth disabled />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField label="Número de Fabricante" value={llamada.nroFabricante || 'S/N'} fullWidth disabled />
              </Grid>
            </Grid>
          )}

          {tabIndex === 1 && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                {hasManualDetails ? (
                  <Button variant="outlined" color="success" startIcon={<ShoppingCartCheckoutIcon />} onClick={handleGenerarOferta}>
                    Generar Oferta de Compra
                  </Button>
                ) : <Box />}
                
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => {
                  setTipoDetalle('REPUESTO');
                  setNuevoDetalle({ itemDetalleId: '', descripcion: '', cantidad: 1, costo: 0, valor: 0, onHandQty: 0 });
                  setModalDetalleOpen(true);
                }}>
                  Agregar Ítem / Detalle
                </Button>
              </Box>

              {/* 🚨 CORRECCIÓN: TableContainer usando 'component={Paper}' en lugar de variant */}
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                <Table>
                  <TableHead sx={{ bgcolor: 'action.hover' }}>
                    <TableRow>
                      <TableCell>Tipo</TableCell>
                      <TableCell>Ítem / Descripción</TableCell>
                      <TableCell align="center">Cantidad</TableCell>
                      <TableCell align="right">Costo</TableCell>
                      <TableCell align="right">Valor (Venta)</TableCell>
                      <TableCell align="center">Quitar</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {detallesLocales.length === 0 ? (
                      <TableRow><TableCell colSpan={6} align="center">No hay detalles registrados</TableCell></TableRow>
                    ) : (
                      detallesLocales.map((d, i) => (
                        <TableRow key={i}>
                          <TableCell><Chip size="small" label={d.tipo} color={d.tipo === 'REPUESTO' ? 'primary' : d.tipo === 'MANUAL' ? 'warning' : 'secondary'} /></TableCell>
                          <TableCell>{d.itemDetalleId}</TableCell>
                          <TableCell align="center">{d.cantidad}</TableCell>
                          <TableCell align="right">${d.costo}</TableCell>
                          <TableCell align="right">${d.valor}</TableCell>
                          <TableCell align="center">
                            <IconButton color="error" size="small" onClick={() => handleQuitarDetalle(i)}>
                              <DeleteOutlineIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {tabIndex === 2 && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 4 }}>
                <Button component="label" variant="contained" startIcon={isUploading ? <CircularProgress size={20} color="inherit" /> : <CloudUploadIcon />} disabled={isUploading} sx={{ px: 4, py: 1.5 }}>
                  {isUploading ? 'Subiendo...' : 'Subir Nuevo Archivo'}
                  <input type="file" hidden onChange={handleFileUpload} />
                </Button>
              </Box>
              
              <Grid container spacing={2}>
                {(!llamada.anexos || llamada.anexos.length === 0) ? (
                  <Grid size={{ xs: 12 }}><Typography align="center" color="text.secondary">No hay anexos subidos</Typography></Grid>
                ) : (
                  llamada.anexos.map((anexo) => (
                    <Grid size={{ xs: 12, sm: 6, md: 4 }} key={anexo.id}>
                      <Paper variant="outlined" sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                          <InsertDriveFileIcon color="action" sx={{ mr: 1 }} />
                          <Typography variant="body2" noWrap title={anexo.nombre} sx={{ maxWidth: 150 }}>
                            {anexo.nombre}
                          </Typography>
                        </Box>
                        <IconButton size="small" color="error" onClick={() => handleDeleteAnexo(anexo.id)}>
                          <DeleteOutlineIcon />
                        </IconButton>
                      </Paper>
                    </Grid>
                  ))
                )}
              </Grid>
            </Box>
          )}

        </Box>
      </Paper>

      <Paper sx={{ mt: 3, p: 3, borderRadius: 2, display: 'flex', justifyContent: 'flex-end', gap: 2, bgcolor: 'background.default' }}>
        <Button 
          variant="contained" 
          color="primary" 
          startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
          onClick={handleBotonActualizar}
          disabled={isSubmitting}
        >
          {needsTransfer ? 'Actualizar (Pedir Transferencia)' : 'Actualizar y Autorizar'}
        </Button>

        <Button 
          variant="contained" 
          color="success" 
          startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : <PlayCircleFilledWhiteIcon />}
          onClick={handleBotonProceso}
          disabled={isSubmitting || needsTransfer} 
        >
          Pasar a PROCESO
        </Button>
      </Paper>

      <Dialog open={modalDetalleOpen} onClose={() => setModalDetalleOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>Agregar Detalle a la Orden</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12 }}>
              <TextField select label="Tipo de Detalle" fullWidth size="small" value={tipoDetalle} onChange={(e) => { 
                setTipoDetalle(e.target.value); setOpcionesBusqueda([]); 
                setNuevoDetalle({ itemDetalleId: '', descripcion: '', cantidad: 1, costo: 0, valor: 0, onHandQty: 0 }); 
              }}>
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
                  onInputChange={(_, val) => buscarItems(val)}
                  onChange={(_, val) => {
                    if (val) {
                      if (isRepuesto(val)) {
                        setNuevoDetalle({ ...nuevoDetalle, itemDetalleId: val.itemCode, costo: 0, valor: 0, onHandQty: val.onHandQty });
                      } else {
                        setNuevoDetalle({ ...nuevoDetalle, itemDetalleId: val.code, costo: 0, valor: val.u_NA_VALOR, onHandQty: 999 });
                      }
                    }
                  }}
                  loading={isBuscando}
                  renderInput={(params) => <TextField {...params} label="Buscar Ítem" size="small" InputProps={{ ...params.InputProps, endAdornment: (<React.Fragment>{isBuscando ? <CircularProgress size={20} /> : null}{params.InputProps.endAdornment}</React.Fragment>) }} />}
                />
              </Grid>
            ) : (
              <Grid size={{ xs: 12 }}>
                <TextField label="Descripción del Ítem (Manual)" fullWidth size="small" value={nuevoDetalle.descripcion} onChange={(e) => setNuevoDetalle({...nuevoDetalle, descripcion: e.target.value})} />
              </Grid>
            )}

            <Grid size={{ xs: 4 }}>
              <TextField label="Cantidad" type="number" fullWidth size="small" value={nuevoDetalle.cantidad} onChange={(e) => setNuevoDetalle({...nuevoDetalle, cantidad: Number(e.target.value)})} />
            </Grid>
            <Grid size={{ xs: 4 }}>
              <TextField label="Costo ($)" type="number" fullWidth size="small" disabled={tipoDetalle !== 'MANUAL'} value={nuevoDetalle.costo} onChange={(e) => setNuevoDetalle({...nuevoDetalle, costo: Number(e.target.value)})} />
            </Grid>
            <Grid size={{ xs: 4 }}>
              <TextField label="Valor Venta ($)" type="number" fullWidth size="small" disabled={tipoDetalle !== 'MANUAL'} value={nuevoDetalle.valor} onChange={(e) => setNuevoDetalle({...nuevoDetalle, valor: Number(e.target.value)})} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setModalDetalleOpen(false)} color="inherit">Cancelar</Button>
          <Button onClick={handleIntentarAgregarDetalle} variant="contained" color="primary" startIcon={<AddIcon />}>Agregar a la Lista</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={stockWarningOpen} onClose={() => setStockWarningOpen(false)}>
        <DialogTitle sx={{ fontWeight: 'bold', color: 'error.main' }}>¡Stock Insuficiente!</DialogTitle>
        <DialogContent>
          <Typography mb={2}>
            Has solicitado <strong>{detallePendiente?.cantidad}</strong> unidades de <strong>{detallePendiente?.itemDetalleId}</strong>, pero solo hay <strong>{nuevoDetalle.onHandQty}</strong> en tu bodega.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            ¿Cómo deseas proceder con este faltante?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, flexDirection: 'column', gap: 1 }}>
          <Button fullWidth variant="outlined" color="primary" onClick={handleOpcionTransferencia}>
            Solicitar Transferencia a Bodega Principal
          </Button>
          <Button fullWidth variant="contained" color="warning" onClick={handleOpcionCompraLocal}>
            Comprarlo Localmente (Ítem Manual)
          </Button>
          <Button fullWidth onClick={() => setStockWarningOpen(false)} color="inherit">
            Cancelar Operación
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};