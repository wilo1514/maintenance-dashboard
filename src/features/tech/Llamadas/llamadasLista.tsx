import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, TextField, MenuItem, Button, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Chip, IconButton, Card,
  CardContent, Stack, CircularProgress, useMediaQuery, Dialog, DialogTitle,
  DialogContent, DialogActions, Avatar, Divider, Checkbox, Tooltip
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { toast } from 'sonner';

import FilterAltIcon from '@mui/icons-material/FilterAlt';
import AddIcon from '@mui/icons-material/Add';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import BuildCircleIcon from '@mui/icons-material/BuildCircle';
import TaskAltIcon from '@mui/icons-material/TaskAlt'; 
import SyncIcon from '@mui/icons-material/Sync'; // 🚨 Icono para reintentar sincronización

import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { useNavigate } from 'react-router-dom';
import api from '../../../services/api';
import { TECH_ENDPOINTS } from '../../../services/endpoints/tech';
import { 
  fetchLlamadas, deleteLlamada, selectAllLlamadas, selectLlamadasLoading, type LlamadaServicio 
} from './llamadasSlice';

import { generarPDFLiquidacion } from '../../../utils/pdfLiquidacion'; 

const getOneMonthAgoDate = () => {
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  return date.toISOString().split('T')[0]; 
};

export const LlamadasList = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const llamadas = useAppSelector(selectAllLlamadas);
  const isLoading = useAppSelector(selectLlamadasLoading);

  const [filtros, setFiltros] = useState({
    fechaDesde: getOneMonthAgoDate(),
    fechaHasta: '',
    estado: 'TODOS'
  });

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [llamadaToDelete, setLlamadaToDelete] = useState<number | null>(null);

  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [llamadaToPreview, setLlamadaToPreview] = useState<LlamadaServicio | null>(null);

  const [selectedParaLiquidar, setSelectedParaLiquidar] = useState<number[]>([]);
  const [isLiquidando, setIsLiquidando] = useState(false);
  const [isSyncingId, setIsSyncingId] = useState<number | null>(null); // Para mostrar carga al sincronizar

  useEffect(() => {
    dispatch(fetchLlamadas(filtros));
  }, [dispatch]);

  const handleApplyFilters = () => {
    dispatch(fetchLlamadas(filtros));
    setSelectedParaLiquidar([]); 
  };

  const handleCreateNew = () => {
    navigate('/tech/llamadas/new');
  };

  const handleEditOrder = (id: number) => {
    navigate(`/tech/llamadas/${id}/edit`);
  };

  // --- REINTENTO DE SINCRONIZACIÓN SAP ---
  const handleRetrySAP = async (llamada: LlamadaServicio) => {
    setIsSyncingId(llamada.id);
    const ocPendiente = llamada.estadoOrdenCompraSap === 'PENDIENTE_SAP';
    const salidaPendiente = llamada.estadoSalidaMercanciaSap === 'PENDIENTE_SAP';

    try {
      if (ocPendiente) {
        await api.post(`/sap/ordenescompra/${llamada.id}`);
        toast.success("Orden de Compra procesada hacia SAP");
      }
      if (salidaPendiente) {
        await api.post(`/sap/salidasmercancia/${llamada.id}`);
        toast.success("Salida de Mercancía procesada hacia SAP");
      }
      // Refrescamos la lista para ver los nuevos estados
      dispatch(fetchLlamadas(filtros));
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : "Error al sincronizar con SAP";
      toast.error(errMsg);
      console.error(error);
    } finally {
      setIsSyncingId(null);
    }
  };

  // --- SELECCIÓN PARA LIQUIDAR ---
  const handleToggleSelect = (id: number) => {
    setSelectedParaLiquidar(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Filtramos las que realmente se pueden liquidar
  const liquidablesDisponibles = llamadas.filter(ll => {
    const isCerrada = ll.estado === 'C';
    const hasPendiente = ll.estadoOrdenCompraSap === 'PENDIENTE_SAP' || ll.estadoSalidaMercanciaSap === 'PENDIENTE_SAP';
    return isCerrada && !hasPendiente;
  });

  const handleSelectAllLiquidables = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedParaLiquidar(liquidablesDisponibles.map(ll => ll.id));
    } else {
      setSelectedParaLiquidar([]);
    }
  };

  const executeLiquidar = async () => {
    if (selectedParaLiquidar.length === 0) return;
    setIsLiquidando(true);

    try {
      toast.info("Recopilando datos y procesando liquidación...");
      const ordenesCompletas: LlamadaServicio[] = [];

      for (const id of selectedParaLiquidar) {
        const res = await api.get<LlamadaServicio>(TECH_ENDPOINTS.GET_LLAMADA_BY_ID(id));
        ordenesCompletas.push(res.data);

        await api.patch(TECH_ENDPOINTS.PATCH_LLAMADA_ESTADO(id), { estado: 'L' });
        await api.patch(TECH_ENDPOINTS.PATCH_SAP_LLAMADA_ESTADO(id), { estado: 'L' });
      }

      generarPDFLiquidacion(ordenesCompletas);

      toast.success('Órdenes Liquidadas y PDF generado con éxito.');
      setSelectedParaLiquidar([]);
      dispatch(fetchLlamadas(filtros)); 
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : "Ocurrió un error desconocido al liquidar";
      toast.error(errMsg);
      console.error(error);
    } finally {
      setIsLiquidando(false);
    }
  };

  const handleViewPreview = async (id: number) => {
    setPreviewModalOpen(true);
    setIsPreviewLoading(true);
    setLlamadaToPreview(null); 
    try {
      const res = await api.get<LlamadaServicio>(TECH_ENDPOINTS.GET_LLAMADA_BY_ID(id));
      setLlamadaToPreview(res.data);
    } catch (error: unknown) {
      toast.error("Error al cargar los detalles de la orden");
      console.error(error);
      setPreviewModalOpen(false);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const confirmDelete = (id: number) => {
    setLlamadaToDelete(id);
    setDeleteModalOpen(true);
  };

  const executeDelete = async () => {
    if (llamadaToDelete === null) return;
    try {
      await dispatch(deleteLlamada(llamadaToDelete)).unwrap();
      toast.success('Orden de servicio eliminada correctamente');
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      toast.error(errMsg);
    } finally {
      setDeleteModalOpen(false);
      setLlamadaToDelete(null);
    }
  };

  const canDeleteLlamada = (llamada: LlamadaServicio) => {
    const estado = llamada.estado.toUpperCase();
    const isPendiente = estado === 'P' || estado === 'PENDIENTE';
    const noDetails = !llamada.detalles || llamada.detalles.length === 0;
    const noAnexos = !llamada.anexos || llamada.anexos.length === 0;
    return isPendiente && noDetails && noAnexos;
  };

  const formatEstado = (estado: string) => {
    const e = (estado || '').toUpperCase();
    switch (e) {
      case 'P': return 'PENDIENTE';
      case 'A': return 'AUTORIZADA';
      case 'E': return 'EN PROCESO';
      case 'C': return 'CERRADA';
      case 'S': return 'STOCK PENDIENTE';
      case 'L': return 'LIQUIDADA';
      default: return e;
    }
  };

  const getStatusColor = (estado: string) => {
    const e = (estado || '').toUpperCase();
    if (e === 'P' || e === 'PENDIENTE') return 'warning';
    if (e === 'A' || e === 'AUTORIZADA') return 'info';
    if (e === 'E' || e === 'EN PROCESO') return 'success';
    if (e === 'S' || e === 'STOCK PENDIENTE') return 'error';
    if (e === 'C' || e === 'CERRADA') return 'secondary';
    if (e === 'L' || e === 'LIQUIDADA') return 'primary';
    return 'default';
  };



  return (
    <Box sx={{ pb: { xs: 10, md: 4 } }}>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar sx={{ bgcolor: 'secondary.main' }}><BuildCircleIcon /></Avatar>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>Órdenes de Servicio</Typography>
            <Typography variant="body2" color="text.secondary">Gestión de llamadas y reparaciones</Typography>
          </Box>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 2, width: { xs: '100%', sm: 'auto' } }}>
          {selectedParaLiquidar.length > 0 && (
            <Button 
              variant="contained" color="secondary" startIcon={isLiquidando ? <CircularProgress size={20} /> : <TaskAltIcon />} 
              onClick={executeLiquidar} disabled={isLiquidando} sx={{ flexGrow: 1 }}
            >
              Liquidar ({selectedParaLiquidar.length})
            </Button>
          )}
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreateNew} sx={{ flexGrow: 1 }}>
            Nueva Orden
          </Button>
        </Box>
      </Box>

      <Paper sx={{ p: { xs: 2, md: 3 }, mb: 3, borderRadius: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, sm: 4, md: 3 }}>
            <TextField 
              label="Fecha Desde" type="date" fullWidth size="small" InputLabelProps={{ shrink: true }} 
              value={filtros.fechaDesde} onChange={(e) => setFiltros({ ...filtros, fechaDesde: e.target.value })} 
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4, md: 3 }}>
            <TextField 
              label="Fecha Hasta" type="date" fullWidth size="small" InputLabelProps={{ shrink: true }} 
              value={filtros.fechaHasta} onChange={(e) => setFiltros({ ...filtros, fechaHasta: e.target.value })} 
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4, md: 3 }}>
            <TextField 
              select label="Estado" fullWidth size="small" 
              value={filtros.estado} onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}
            >
              <MenuItem value="TODOS">Todos</MenuItem>
              <MenuItem value="P">Pendiente (P)</MenuItem>
              <MenuItem value="A">Autorizada (A)</MenuItem>
              <MenuItem value="E">En Proceso (E)</MenuItem>
              <MenuItem value="S">Stock Pendiente (S)</MenuItem>
              <MenuItem value="C">Cerrada (C)</MenuItem>
            </TextField>
          </Grid>

          <Grid size={{ xs: 12, md: 3 }}>
            <Button variant="contained" color="primary" fullWidth startIcon={<FilterAltIcon />} onClick={handleApplyFilters} sx={{ height: '40px' }}>
              Aplicar Filtros
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>
      ) : llamadas.length === 0 ? (
        <Paper sx={{ p: 5, textAlign: 'center', borderRadius: 2 }}>
          <Typography color="text.secondary">No se encontraron órdenes de servicio en este rango.</Typography>
        </Paper>
      ) : isMobile ? (
        <Stack spacing={2}>
          {llamadas.map((llamada) => {
            const canDelete = canDeleteLlamada(llamada);
            const isCerrada = llamada.estado === 'C';
            const hasPendienteSAP = llamada.estadoOrdenCompraSap === 'PENDIENTE_SAP' || llamada.estadoSalidaMercanciaSap === 'PENDIENTE_SAP';
            const canLiquidar = isCerrada && !hasPendienteSAP;
            
            return (
              <Card key={llamada.id} elevation={2} sx={{ borderRadius: 2 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {isCerrada && (
                        <Checkbox 
                          size="small" sx={{ p: 0 }}
                          checked={selectedParaLiquidar.includes(llamada.id)}
                          onChange={() => handleToggleSelect(llamada.id)}
                          disabled={!canLiquidar} 
                        />
                      )}
                      <Typography variant="subtitle1" fontWeight="bold" color="primary">OS #{llamada.id}</Typography>
                    </Box>
                    <Chip size="small" label={formatEstado(llamada.estado)} color={getStatusColor(llamada.estado)} sx={{ fontWeight: 'bold' }} />
                  </Box>
                  <Typography variant="body2" color="text.secondary"><strong>Fecha:</strong> {llamada.fecha.split('T')[0]}</Typography>
                  <Typography variant="body2" color="text.secondary"><strong>Cliente ID:</strong> {llamada.clienteId}</Typography>
                  <Typography variant="body2" color="text.secondary"><strong>Equipo:</strong> {llamada.itemIncidenciaId}</Typography>
                  
                  {hasPendienteSAP && (
                    <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>
                      * Documentos SAP Pendientes de Envío
                    </Typography>
                  )}

                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2, gap: 1 }}>
                    {hasPendienteSAP && (
                       <Tooltip title="Reintentar Sincronización SAP">
                        <IconButton 
                          color="warning" 
                          size="small" 
                          onClick={() => handleRetrySAP(llamada)}
                          disabled={isSyncingId === llamada.id}
                        >
                          {isSyncingId === llamada.id ? <CircularProgress size={20} color="warning" /> : <SyncIcon />}
                        </IconButton>
                       </Tooltip>
                    )}
                    {canDelete && (
                      <IconButton color="error" size="small" onClick={() => confirmDelete(llamada.id)}>
                        <DeleteOutlineIcon />
                      </IconButton>
                    )}
                    <IconButton color="info" size="small" onClick={() => handleViewPreview(llamada.id)}>
                      <VisibilityIcon />
                    </IconButton>
                    <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={() => handleEditOrder(llamada.id)}>
                      Editar
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead sx={{ backgroundColor: 'action.hover' }}>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={selectedParaLiquidar.length > 0 && selectedParaLiquidar.length < liquidablesDisponibles.length}
                    checked={liquidablesDisponibles.length > 0 && selectedParaLiquidar.length === liquidablesDisponibles.length}
                    onChange={handleSelectAllLiquidables}
                    disabled={liquidablesDisponibles.length === 0}
                  />
                </TableCell>
                <TableCell>Nro. OS</TableCell>
                <TableCell>Fecha</TableCell>
                <TableCell>Cliente ID</TableCell>
                <TableCell>Equipo</TableCell>
                <TableCell align="center">Estado SAP</TableCell>
                <TableCell align="center">Estado</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {llamadas.map((llamada) => {
                const canDelete = canDeleteLlamada(llamada);
                const isCerrada = llamada.estado === 'C';
                const hasPendienteSAP = llamada.estadoOrdenCompraSap === 'PENDIENTE_SAP' || llamada.estadoSalidaMercanciaSap === 'PENDIENTE_SAP';
                const canLiquidar = isCerrada && !hasPendienteSAP;

                return (
                  <TableRow key={llamada.id} hover selected={selectedParaLiquidar.includes(llamada.id)}>
                    <TableCell padding="checkbox">
                      {isCerrada ? (
                        <Checkbox 
                          checked={selectedParaLiquidar.includes(llamada.id)} 
                          onChange={() => handleToggleSelect(llamada.id)} 
                          disabled={!canLiquidar} 
                        />
                      ) : null}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>#{llamada.id}</TableCell>
                    <TableCell>{llamada.fecha.split('T')[0]}</TableCell>
                    <TableCell>{llamada.clienteId}</TableCell>
                    <TableCell>{llamada.itemIncidenciaId}</TableCell>
                    <TableCell align="center">
                      {hasPendienteSAP ? (
                         <Chip size="small" label="PENDIENTE SAP" color="error" variant="outlined" />
                      ) : (
                         <Chip size="small" label="OK" color="success" variant="outlined" />
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Chip size="small" label={formatEstado(llamada.estado)} color={getStatusColor(llamada.estado)} sx={{ fontWeight: 'bold' }} />
                    </TableCell>
                    <TableCell align="right">
                      {hasPendienteSAP && (
                         <Tooltip title="Reintentar Sincronización SAP">
                          <IconButton 
                            color="warning" 
                            onClick={() => handleRetrySAP(llamada)}
                            disabled={isSyncingId === llamada.id}
                          >
                            {isSyncingId === llamada.id ? <CircularProgress size={20} color="warning" /> : <SyncIcon />}
                          </IconButton>
                         </Tooltip>
                      )}
                      <IconButton color="info" title="Ver Detalles" onClick={() => handleViewPreview(llamada.id)}>
                        <VisibilityIcon />
                      </IconButton>
                      <IconButton color="primary" title="Editar Orden" onClick={() => handleEditOrder(llamada.id)}>
                        <EditIcon />
                      </IconButton>
                      {canDelete && (
                        <IconButton color="error" title="Eliminar Borrador" onClick={() => confirmDelete(llamada.id)}>
                          <DeleteOutlineIcon />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* --- MODALES OMITIDOS EN ESTE TEXTO PARA BREVEDAD (PERO DEBES DEJARLOS IGUAL QUE ANTES) --- */}
      <Dialog open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)}>
        <DialogTitle sx={{ fontWeight: 'bold', color: 'error.main' }}>Eliminar Orden de Servicio</DialogTitle>
        <DialogContent>
          <Typography>¿Estás seguro que deseas eliminar permanentemente el borrador de esta orden? Esta acción no se puede deshacer.</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteModalOpen(false)} color="inherit">Cancelar</Button>
          <Button onClick={executeDelete} variant="contained" color="error">Eliminar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={previewModalOpen} onClose={() => setPreviewModalOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Detalle de Orden #{llamadaToPreview?.id || '...'}</span>
          {llamadaToPreview && (
            <Chip label={formatEstado(llamadaToPreview.estado)} color={getStatusColor(llamadaToPreview.estado)} sx={{ fontWeight: 'bold' }} />
          )}
        </DialogTitle>
        <DialogContent dividers sx={{ minHeight: '300px' }}>
          {isPreviewLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <CircularProgress />
            </Box>
          ) : llamadaToPreview ? (
            <Grid container spacing={3}>
              <Grid size={{ xs: 12 }}>
                <Typography variant="subtitle1" color="primary" fontWeight="bold">Información General</Typography>
                <Divider sx={{ mb: 2 }} />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Typography variant="body2" color="text.secondary">Fecha de Creación</Typography>
                <Typography variant="body1">{llamadaToPreview.fecha.split('T')[0]}</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Typography variant="body2" color="text.secondary">Cliente ID</Typography>
                <Typography variant="body1">{llamadaToPreview.clienteId}</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Typography variant="body2" color="text.secondary">Equipo / Ítem</Typography>
                <Typography variant="body1">{llamadaToPreview.itemIncidenciaId}</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Typography variant="body2" color="text.secondary">Número Serie</Typography>
                <Typography variant="body1">{llamadaToPreview.nroSerie || 'S/N'}</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Typography variant="body2" color="text.secondary">Número Fabricante</Typography>
                <Typography variant="body1">{llamadaToPreview.nroFabricante || 'S/N'}</Typography>
              </Grid>

              <Grid size={{ xs: 12 }} sx={{ mt: 2 }}>
                <Typography variant="subtitle1" color="primary" fontWeight="bold">Repuestos y Servicios Cargados</Typography>
                <Divider sx={{ mb: 2 }} />
                
                {(!llamadaToPreview.detalles || llamadaToPreview.detalles.length === 0) ? (
                  <Typography variant="body2" color="text.secondary">No hay detalles registrados en esta orden.</Typography>
                ) : (
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead sx={{ bgcolor: 'action.hover' }}>
                        <TableRow>
                          <TableCell>Tipo</TableCell>
                          <TableCell>Descripción</TableCell>
                          <TableCell align="center">Cant.</TableCell>
                          <TableCell align="right">Total ($)</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {llamadaToPreview.detalles.map((d, i) => (
                          <TableRow key={i}>
                            <TableCell><Chip size="small" label={d.tipo} color={d.tipo === 'REPUESTO' ? 'primary' : 'default'} /></TableCell>
                            <TableCell>{d.itemDetalleId}</TableCell>
                            <TableCell align="center">{d.cantidad}</TableCell>
                            <TableCell align="right">${Number(d.valor).toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Grid>
            </Grid>
          ) : (
            <Typography align="center" color="text.secondary">No se pudo cargar la información.</Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setPreviewModalOpen(false)} color="inherit">Cerrar Visor</Button>
          {llamadaToPreview && (
            <Button 
              variant="contained" color="primary" startIcon={<EditIcon />} 
              onClick={() => { setPreviewModalOpen(false); handleEditOrder(llamadaToPreview.id); }}
            >
              Ir a Editar
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};