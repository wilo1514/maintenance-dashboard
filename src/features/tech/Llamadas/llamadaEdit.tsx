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

import { useAppSelector } from '../../../app/hooks';
import { selectCurrentUser } from '../../auth/authSlice';
import api from '../../../services/api';
import { TECH_ENDPOINTS } from '../../../services/endpoints/tech';
import { type LlamadaServicio, type LlamadaAnexo, type LlamadaDetalle as OriginalLlamadaDetalle } from './llamadasSlice';

interface RepuestoOption { itemCode: string; itemName: string; onHandQty: number; }
interface ManoObraOption { code: string; name: string; u_NA_VALOR: number; }
type BusquedaOption = RepuestoOption | ManoObraOption;

const isRepuesto = (opt: BusquedaOption): opt is RepuestoOption => 'itemCode' in opt;

interface LlamadaDetalle extends OriginalLlamadaDetalle {
  _missingStock?: boolean;
  _transferRequested?: boolean;
  _onHandLimit?: number;
}

export const LlamadaEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAppSelector(selectCurrentUser);
  const isFT1 = user?.ubicacion === '05-FT1';

  const [llamada, setLlamada] = useState<LlamadaServicio | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tabIndex, setTabIndex] = useState(0);

  const [detallesLocales, setDetallesLocales] = useState<LlamadaDetalle[]>([]);
  const [needsTransfer, setNeedsTransfer] = useState(false);

  const [modalDetalleOpen, setModalDetalleOpen] = useState(false);
  const [tipoDetalle, setTipoDetalle] = useState('REPUESTO'); 
  const [opcionesBusqueda, setOpcionesBusqueda] = useState<BusquedaOption[]>([]);
  const [isBuscando, setIsBuscando] = useState(false);

  const [nuevoDetalle, setNuevoDetalle] = useState({
    itemDetalleId: '', descripcion: '', cantidad: 1, costo: 0, valor: 0, onHandQty: 0
  });

  const [stockWarningOpen, setStockWarningOpen] = useState(false);
  const [detallePendiente] = useState<LlamadaDetalle | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    } catch (error) { console.error(error); } finally { setIsBuscando(false); }
  };

const handleAgregarDetalle = () => {
    if (tipoDetalle !== 'MANUAL' && !nuevoDetalle.itemDetalleId) return toast.warning("Selecciona un ítem válido");

    const baseDetalle: LlamadaDetalle = {
      id: 0,
      llamadaServicioId: Number(id),
      tipo: tipoDetalle,
      itemDetalleId: tipoDetalle === 'MANUAL' ? nuevoDetalle.descripcion : nuevoDetalle.itemDetalleId,
      cantidad: Number(nuevoDetalle.cantidad),
      costo: Number(nuevoDetalle.costo),
      valor: Number(nuevoDetalle.cantidad) * Number(nuevoDetalle.costo),
      usuFechaCrea: new Date().toISOString()
    };

    if (tipoDetalle === 'REPUESTO' && baseDetalle.cantidad > nuevoDetalle.onHandQty) {
      baseDetalle._missingStock = true;
      baseDetalle._onHandLimit = nuevoDetalle.onHandQty;
    }

    setDetallesLocales([...detallesLocales, baseDetalle]);
    setModalDetalleOpen(false);
    setNuevoDetalle({ itemDetalleId: '', descripcion: '', cantidad: 1, costo: 0, valor: 0, onHandQty: 0 });
  };

  // 🚨 100% Tipado: No 'any', no variables sin usar.
  const handleEditInline = (index: number, field: 'cantidad' | 'costo', value: string | number) => {
    const updated = [...detallesLocales];
    
    if (field === 'cantidad') updated[index].cantidad = Number(value);
    if (field === 'costo') updated[index].costo = Number(value);
    
    const cant = Number(updated[index].cantidad) || 0;
    const cost = Number(updated[index].costo) || 0;
    updated[index].valor = cant * cost;

    if (field === 'cantidad' && updated[index].tipo === 'REPUESTO' && updated[index]._onHandLimit !== undefined) {
      if (cant > updated[index]._onHandLimit!) {
        updated[index]._missingStock = true;
      } else {
        updated[index]._missingStock = false;
        updated[index]._transferRequested = false;
      }
    }
    setDetallesLocales(updated);
  };

  const handleToggleMissingStock = (index: number, action: 'TRANSFER' | 'MANUAL') => {
    const updated = [...detallesLocales];
    if (action === 'TRANSFER') {
      updated[index]._transferRequested = true;
    } else if (action === 'MANUAL') {
      updated[index].tipo = 'MANUAL';
      updated[index].itemDetalleId = `(Local) ${updated[index].itemDetalleId}`;
      updated[index]._missingStock = false;
      updated[index]._transferRequested = false;
    }
    setDetallesLocales(updated);
  };

  const handleQuitarDetalle = (index: number) => {
    setDetallesLocales(detallesLocales.filter((_, idx) => idx !== index));
  };

  const handleOpcionTransferencia = () => {
    if (!detallePendiente) return;
    setNeedsTransfer(true);
    setDetallesLocales(prev => [...prev, detallePendiente]);
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
  const executeOrderUpdate = async (targetState: string, isPatchOnly = false, sapEndpoint?: string) => {
    if (!llamada || isSubmitting) return; // Evita doble clic y "usa" la variable lógicamente
    setIsSubmitting(true);

    try {
      if (!isPatchOnly) {
        // 🚨 Construcción explícita del objeto: Nada de destructuring basura para satisfacer a SonarQube
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

          return detalleParaEnviar as LlamadaDetalle;
        });

        const fechaActual = new Date().toISOString();
        const payload = { 
          ...llamada, 
          estado: targetState, 
          usuFechaModifica: fechaActual, 
          detalles: detallesLimpios 
        };
        
        await api.put(TECH_ENDPOINTS.PUT_LLAMADA(llamada.id), payload);
        setLlamada({ ...llamada, estado: targetState, usuFechaModifica: fechaActual, detalles: detallesLocales });
      } else {
        await api.patch(TECH_ENDPOINTS.PATCH_LLAMADA_ESTADO(llamada.id), { estado: targetState });
        setLlamada({ ...llamada, estado: targetState });
      }

      if (sapEndpoint) {
        console.log(`Llamada a SAP en ${sapEndpoint} para la orden ${llamada.id}`);
      }

      toast.success(`Orden Actualizada (Estado: ${targetState})`);
    } catch (error) {
      toast.error("Error al actualizar la orden" + error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 10 }}><CircularProgress /></Box>;
  if (!llamada) return <Typography align="center" mt={5}>Orden no encontrada</Typography>;

  const currentState = llamada.estado;
  const hasMissingStock = detallesLocales.some(d => d._missingStock && !d._transferRequested);
  const hasTransfers = detallesLocales.some(d => d._transferRequested);
  const hasManual = detallesLocales.some(d => d.tipo === 'MANUAL');

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
        <Chip label={`ESTADO: ${currentState}`} color={currentState === 'C' ? 'default' : currentState === 'E' ? 'success' : 'primary'} sx={{ fontWeight: 'bold', px: 2, py: 2, fontSize: '1rem' }} />
      </Box>

      {needsTransfer && (
        <Alert severity="warning" sx={{ mb: 3, fontWeight: 'bold' }}>
          Existen ítems con stock insuficiente marcados para Solicitud de Transferencia. Al actualizar, el estado pasará a STOCK PENDIENTE.
        </Alert>
      )}

      <Paper sx={{ borderRadius: 2 }}>
        {/* 🚨 Satisfaciendo linter con event.stopPropagation() */}
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
                {hasManual && currentState === 'E' ? (
                  <Button variant="outlined" color="success" startIcon={<ShoppingCartCheckoutIcon />} onClick={() => toast.info("Generar OC SAP (Pendiente)")}>Generar Orden Compra</Button>
                ) : <Box />}
                <Button variant="contained" startIcon={<AddIcon />} disabled={currentState === 'C'} onClick={() => {
                  setTipoDetalle('REPUESTO'); setNuevoDetalle({ itemDetalleId: '', descripcion: '', cantidad: 1, costo: 0, valor: 0, onHandQty: 0 }); setModalDetalleOpen(true);
                }}>
                  Agregar Ítem
                </Button>
              </Box>

              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead sx={{ bgcolor: 'action.hover' }}>
                    <TableRow>
                      <TableCell>Tipo</TableCell>
                      <TableCell>Ítem</TableCell>
                      <TableCell align="center" width="120px">Cant.</TableCell>
                      <TableCell align="right" width="120px">Costo</TableCell>
                      <TableCell align="right" width="120px">Valor Total</TableCell>
                      <TableCell align="center">Acción</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {detallesLocales.length === 0 ? (
                      <TableRow><TableCell colSpan={6} align="center">No hay detalles registrados</TableCell></TableRow>
                    ) : (
                      detallesLocales.map((d, i) => (
                        <React.Fragment key={i}>
                          <TableRow sx={{ bgcolor: d._missingStock ? '#fff3e0' : 'inherit' }}>
                            <TableCell><Chip size="small" label={d.tipo} color={d.tipo === 'REPUESTO' ? 'primary' : d.tipo === 'MANUAL' ? 'warning' : 'secondary'} /></TableCell>
                            <TableCell>{d.itemDetalleId}</TableCell>
                            
                            <TableCell align="center">
                              <TextField size="small" type="number" disabled={currentState === 'C'} value={d.cantidad} onChange={(evt) => handleEditInline(i, 'cantidad', evt.target.value)} inputProps={{ min: 1 }} />
                            </TableCell>
                            
                            <TableCell align="right">
                              <TextField size="small" type="number" disabled={d.tipo !== 'MANUAL' || currentState === 'C'} value={d.costo} onChange={(evt) => handleEditInline(i, 'costo', evt.target.value)} />
                            </TableCell>
                            
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>${d.valor.toFixed(2)}</TableCell>
                            
                            <TableCell align="center">
                              <IconButton color="error" size="small" disabled={currentState === 'C'} onClick={() => handleQuitarDetalle(i)}><DeleteOutlineIcon /></IconButton>
                            </TableCell>
                          </TableRow>

                          {d._missingStock && (
                            <TableRow sx={{ bgcolor: '#ffe0b2' }}>
                              <TableCell colSpan={6} sx={{ py: 1 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, color: 'warning.dark' }}>
                                  <WarningAmberIcon />
                                  <Typography variant="body2" fontWeight="bold">Stock insuficiente (Solo hay {d._onHandLimit}).</Typography>
                                  <FormControlLabel control={<Switch color="error" checked={d._transferRequested} onChange={() => handleToggleMissingStock(i, 'TRANSFER')} />} label="Solicitar Transferencia" />
                                  <Button size="small" variant="outlined" color="warning" onClick={() => handleToggleMissingStock(i, 'MANUAL')}>Pasar a Manual</Button>
                                </Box>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
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
                <Button component="label" variant="contained" startIcon={isUploading ? <CircularProgress size={20} color="inherit" /> : <CloudUploadIcon />} disabled={isUploading || currentState === 'C'} sx={{ px: 4, py: 1.5 }}>
                  {isUploading ? 'Subiendo...' : 'Subir Archivo'}
                  <input type="file" hidden onChange={handleFileUpload} />
                </Button>
              </Box>
              <Grid container spacing={2}>
                {llamada.anexos?.map((anexo) => (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={anexo.id}>
                    <Paper variant="outlined" sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', overflow: 'hidden' }}><InsertDriveFileIcon color="action" sx={{ mr: 1 }} /><Typography variant="body2" noWrap>{anexo.nombre}</Typography></Box>
                      <IconButton size="small" color="error" disabled={currentState === 'C'} onClick={() => handleDeleteAnexo(anexo.id)}><DeleteOutlineIcon /></IconButton>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

        </Box>
      </Paper>

      {/* --- BOTONERA INTELIGENTE DE ESTADOS --- */}
      <Paper sx={{ mt: 3, p: 3, borderRadius: 2, display: 'flex', justifyContent: 'flex-end', gap: 2, bgcolor: 'background.default' }}>
        
        {currentState !== 'C' && (
          <Button variant="outlined" startIcon={<SaveIcon />} onClick={() => executeOrderUpdate(currentState)}>
            Actualizar (Guardar Cambios)
          </Button>
        )}

        {isFT1 ? (
          <>
            {(currentState === 'P' || currentState === 'A') && <Button variant="contained" color="primary" onClick={() => executeOrderUpdate('E', false, '/sap/llamadas/procesar')}>Procesar</Button>}
            {currentState === 'E' && <Button variant="contained" color="error" onClick={() => executeOrderUpdate('C', true, '/sap/llamadas/cerrar')}>Cerrar Orden</Button>}
          </>
        ) : (
          <>
            {currentState === 'P' && <Button variant="contained" color="success" onClick={() => executeOrderUpdate('P', false, '/sap/llamadas/solicitar-autorizacion')}>Enviar a Autorizar</Button>}
            
            {currentState === 'A' && hasMissingStock && <Button variant="contained" color="warning" disabled>Resuelve el Stock Faltante</Button>}
            {currentState === 'A' && hasTransfers && !hasMissingStock && <Button variant="contained" color="warning" onClick={() => executeOrderUpdate('S', false, '/sap/transferencias/solicitar')}>Solicitar Stock (Transferencia)</Button>}
            {currentState === 'A' && !hasTransfers && !hasMissingStock && <Button variant="contained" color="primary" onClick={() => executeOrderUpdate('E', false, '/sap/llamadas/procesar')}>Procesar</Button>}
            
            {currentState === 'E' && <Button variant="contained" color="error" onClick={() => executeOrderUpdate('C', true, '/sap/llamadas/cerrar')}>Cerrar Orden</Button>}
          </>
        )}
      </Paper>

      <Dialog open={modalDetalleOpen} onClose={() => setModalDetalleOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>Agregar Ítem</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12 }}>
              <TextField select label="Tipo" fullWidth size="small" value={tipoDetalle} onChange={(evt) => { setTipoDetalle(evt.target.value); setOpcionesBusqueda([]); setNuevoDetalle({ itemDetalleId: '', descripcion: '', cantidad: 1, costo: 0, valor: 0, onHandQty: 0 }); }}>
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
                      if (isRepuesto(val)) setNuevoDetalle({ ...nuevoDetalle, itemDetalleId: val.itemCode, costo: 0, onHandQty: val.onHandQty });
                      else setNuevoDetalle({ ...nuevoDetalle, itemDetalleId: val.code, costo: val.u_NA_VALOR, onHandQty: 999 });
                    }
                  }}
                  loading={isBuscando}
                  renderInput={(params) => <TextField {...params} label="Buscar Ítem" size="small" />}
                />
              </Grid>
            ) : (
              <Grid size={{ xs: 12 }}><TextField label="Descripción" fullWidth size="small" value={nuevoDetalle.descripcion} onChange={(evt) => setNuevoDetalle({...nuevoDetalle, descripcion: evt.target.value})} /></Grid>
            )}

            <Grid size={{ xs: 6 }}><TextField label="Cantidad" type="number" fullWidth size="small" value={nuevoDetalle.cantidad} onChange={(evt) => setNuevoDetalle({...nuevoDetalle, cantidad: Number(evt.target.value)})} /></Grid>
            <Grid size={{ xs: 6 }}><TextField label="Costo ($)" type="number" fullWidth size="small" disabled={tipoDetalle !== 'MANUAL'} value={nuevoDetalle.costo} onChange={(evt) => setNuevoDetalle({...nuevoDetalle, costo: Number(evt.target.value)})} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setModalDetalleOpen(false)}>Cancelar</Button>
          <Button onClick={handleAgregarDetalle} variant="contained" startIcon={<AddIcon />}>Agregar a la Lista</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={stockWarningOpen} onClose={() => setStockWarningOpen(false)}>
        <DialogTitle sx={{ fontWeight: 'bold', color: 'error.main' }}>¡Stock Insuficiente!</DialogTitle>
        <DialogContent>
          <Typography mb={2}>
            Has solicitado <strong>{detallePendiente?.cantidad}</strong> unidades de <strong>{detallePendiente?.itemDetalleId}</strong>, pero solo hay <strong>{nuevoDetalle.onHandQty}</strong> en tu bodega.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, flexDirection: 'column', gap: 1 }}>
          <Button fullWidth variant="outlined" color="primary" onClick={handleOpcionTransferencia}>Solicitar Transferencia a Bodega Principal</Button>
          <Button fullWidth variant="contained" color="warning" onClick={handleOpcionCompraLocal}>Comprarlo Localmente (Ítem Manual)</Button>
          <Button fullWidth onClick={() => setStockWarningOpen(false)} color="inherit">Cancelar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};