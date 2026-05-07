import { useEffect, useState } from 'react';
import {
  Avatar, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog,
  DialogActions, DialogContent, DialogTitle, Divider, Grid, IconButton,
  MenuItem, Pagination, Paper, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Typography, useMediaQuery
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { toast } from 'sonner';

import FilterAltIcon from '@mui/icons-material/FilterAlt';
import ListAltIcon from '@mui/icons-material/ListAlt';
import VisibilityIcon from '@mui/icons-material/Visibility';

import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import api from '../../../services/api';
import { TECH_ENDPOINTS } from '../../../services/endpoints/tech';
import {
  fetchLlamadas,
  selectAllLlamadas,
  selectLlamadasLoading,
  selectLlamadasTotalPages,
  type LlamadaServicio
} from './llamadasSlice';
import { FloatingScrollButtons } from '../../../components/layout/FloatingScrollButtons';

const PAGE_SIZE = 15;

interface ServicioTecnicoOption {
  absEntry?: number;
  binCode: string;
}

const ubicacionCollator = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });

const getOneMonthAgoDate = () => {
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  return date.toISOString().split('T')[0];
};

const formatNroOS = (llamada: LlamadaServicio) => {
  return llamada.nroDocumento ? String(llamada.nroDocumento) : `Borrador #${llamada.id}`;
};

const formatMoney = (value: unknown) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toFixed(2) : '0.00';
};

const formatEstado = (estado: string) => {
  const e = (estado || '').toUpperCase();
  switch (e) {
    case 'P': return 'PENDIENTE';
    case 'A': return 'AUTORIZADA';
    case 'T': return 'ABIERTA';
    case 'C': return 'CERRADA';
    case 'S': return 'STOCK PENDIENTE';
    case 'N': return 'NEGADA';
    default: return e;
  }
};

const getStatusColor = (estado: string) => {
  const e = (estado || '').toUpperCase();
  if (e === 'P' || e === 'PENDIENTE') return 'warning';
  if (e === 'A' || e === 'AUTORIZADA') return 'info';
  if (e === 'T' || e === 'ABIERTA') return 'success';
  if (e === 'S' || e === 'STOCK PENDIENTE') return 'error';
  if (e === 'N' || e === 'NEGADA') return 'default';
  if (e === 'C' || e === 'CERRADA') return 'secondary';
  return 'default';
};

export const LlamadasServiciosList = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const dispatch = useAppDispatch();

  const llamadas = useAppSelector(selectAllLlamadas);
  const isLoading = useAppSelector(selectLlamadasLoading);
  const totalPages = useAppSelector(selectLlamadasTotalPages);

  const [filtros, setFiltros] = useState({
    fechaDesde: getOneMonthAgoDate(),
    fechaHasta: '',
    estado: 'TODOS',
    servicioTecnico: 'TODOS'
  });
  const [page, setPage] = useState(1);
  const [serviciosTecnicos, setServiciosTecnicos] = useState<ServicioTecnicoOption[]>([]);
  const [isLoadingServicios, setIsLoadingServicios] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [llamadaToPreview, setLlamadaToPreview] = useState<LlamadaServicio | null>(null);

  useEffect(() => {
    const cargarServiciosTecnicos = async () => {
      setIsLoadingServicios(true);
      try {
        const res = await api.get<ServicioTecnicoOption[]>(TECH_ENDPOINTS.GET_SAP_UBICACIONES('05'));
        const data = Array.isArray(res.data) ? res.data : [];
        setServiciosTecnicos([...data].sort((a, b) => ubicacionCollator.compare(a.binCode, b.binCode)));
      } catch (error) {
        console.error(error);
        toast.error('Error al cargar servicios técnicos');
      } finally {
        setIsLoadingServicios(false);
      }
    };
    cargarServiciosTecnicos();
  }, []);

  useEffect(() => {
    dispatch(fetchLlamadas({
      ...filtros,
      allLocations: filtros.servicioTecnico === 'TODOS',
      servicioTecnico: filtros.servicioTecnico !== 'TODOS' ? filtros.servicioTecnico : undefined,
      pagina: page,
      recordsPorPagina: PAGE_SIZE
    }));
  }, [dispatch, page]);

  const handleApplyFilters = () => {
    if (page === 1) {
      dispatch(fetchLlamadas({
        ...filtros,
        allLocations: filtros.servicioTecnico === 'TODOS',
        servicioTecnico: filtros.servicioTecnico !== 'TODOS' ? filtros.servicioTecnico : undefined,
        pagina: 1,
        recordsPorPagina: PAGE_SIZE
      }));
    } else {
      setPage(1);
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
      toast.error('Error al cargar los detalles de la orden');
      console.error(error);
      setPreviewModalOpen(false);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  return (
    <Box sx={{ pb: { xs: 10, md: 4 } }}>
      <Paper sx={{ p: 2, mb: 3, borderRadius: 2, bgcolor: 'info.lighter' }}>
        <Typography variant="h5" fontWeight="bold">OS Servicios Técnicos</Typography>
        <Typography variant="body2" color="text.secondary">Órdenes de servicio de todos los servicios técnicos.</Typography>
      </Paper>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Avatar sx={{ bgcolor: 'secondary.main' }}><ListAltIcon /></Avatar>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 'bold' }}>Órdenes de Servicio</Typography>
          <Typography variant="body2" color="text.secondary">Consulta general para 05-FT1</Typography>
        </Box>
      </Box>

      <Paper sx={{ p: { xs: 2, md: 3 }, mb: 3, borderRadius: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, sm: 4, md: 3 }}>
            <TextField
              label="Fecha Desde"
              type="date"
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
              value={filtros.fechaDesde}
              onChange={(e) => setFiltros({ ...filtros, fechaDesde: e.target.value })}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4, md: 3 }}>
            <TextField
              label="Fecha Hasta"
              type="date"
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
              value={filtros.fechaHasta}
              onChange={(e) => setFiltros({ ...filtros, fechaHasta: e.target.value })}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4, md: 3 }}>
            <TextField
              select
              label="Servicio Técnico"
              fullWidth
              size="small"
              value={filtros.servicioTecnico}
              onChange={(e) => setFiltros({ ...filtros, servicioTecnico: e.target.value })}
              disabled={isLoadingServicios}
            >
              <MenuItem value="TODOS">Todos</MenuItem>
              {serviciosTecnicos.map((servicio) => (
                <MenuItem key={servicio.absEntry ?? servicio.binCode} value={servicio.binCode}>
                  {servicio.binCode}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 4, md: 3 }}>
            <TextField
              select
              label="Estado"
              fullWidth
              size="small"
              value={filtros.estado}
              onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}
            >
              <MenuItem value="TODOS">Todos</MenuItem>
              <MenuItem value="P">Pendiente (P)</MenuItem>
              <MenuItem value="A">Autorizada (A)</MenuItem>
              <MenuItem value="E">En Proceso (E)</MenuItem>
              <MenuItem value="S">Stock Pendiente (S)</MenuItem>
              <MenuItem value="C">Cerrada (C)</MenuItem>
              <MenuItem value="N">Negada (N)</MenuItem>
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
          {llamadas.map((llamada) => (
            <Card key={llamada.id} elevation={2} sx={{ borderRadius: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle1" fontWeight="bold" color="primary">OS {formatNroOS(llamada)}</Typography>
                  <Chip size="small" label={formatEstado(llamada.estado)} color={getStatusColor(llamada.estado)} sx={{ fontWeight: 'bold' }} />
                </Box>
                <Typography variant="body2" color="text.secondary"><strong>Fecha:</strong> {llamada.fecha.split('T')[0]}</Typography>
                <Typography variant="body2" color="text.secondary"><strong>Cliente ID:</strong> {llamada.clienteId}</Typography>
                <Typography variant="body2" color="text.secondary"><strong>Equipo:</strong> {llamada.itemIncidenciaId}</Typography>
                <Typography variant="body2" color="text.secondary"><strong>Servicio Técnico:</strong> {llamada.ubicacion || 'Sin ubicación'}</Typography>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                  <IconButton color="info" size="small" onClick={() => handleViewPreview(llamada.id)}>
                    <VisibilityIcon />
                  </IconButton>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Stack>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead sx={{ backgroundColor: 'action.hover' }}>
              <TableRow>
                <TableCell>Nro. OS</TableCell>
                <TableCell>Fecha</TableCell>
                <TableCell>Cliente ID</TableCell>
                <TableCell>Equipo</TableCell>
                <TableCell>Servicio Técnico</TableCell>
                <TableCell align="center">Estado SAP</TableCell>
                <TableCell align="center">Estado</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {llamadas.map((llamada) => {
                const hasPendienteSAP = llamada.estadoOrdenCompraSap === 'PENDIENTE_SAP' || llamada.estadoSalidaMercanciaSap === 'PENDIENTE_SAP';
                return (
                  <TableRow key={llamada.id} hover>
                    <TableCell sx={{ fontWeight: 'bold' }}>{formatNroOS(llamada)}</TableCell>
                    <TableCell>{llamada.fecha.split('T')[0]}</TableCell>
                    <TableCell>{llamada.clienteId}</TableCell>
                    <TableCell>{llamada.itemIncidenciaId}</TableCell>
                    <TableCell>{llamada.ubicacion || 'Sin ubicación'}</TableCell>
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
                      <IconButton color="info" title="Ver Detalles" onClick={() => handleViewPreview(llamada.id)}>
                        <VisibilityIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {llamadas.length > 0 && totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination count={totalPages} page={page} onChange={(_, value) => setPage(value)} color="primary" size={isMobile ? 'small' : 'medium'} />
        </Box>
      )}

      <Dialog open={previewModalOpen} onClose={() => setPreviewModalOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Detalle de Orden {llamadaToPreview ? formatNroOS(llamadaToPreview) : '...'}</span>
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
                <Typography variant="body2" color="text.secondary">Prioridad</Typography>
                <Typography variant="body1">{llamadaToPreview.prioridad || 'Sin prioridad'}</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Typography variant="body2" color="text.secondary">Servicio Técnico</Typography>
                <Typography variant="body1">{llamadaToPreview.ubicacion || 'Sin ubicación'}</Typography>
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
                        {llamadaToPreview.detalles.map((detalle, index) => (
                          <TableRow key={index}>
                            <TableCell><Chip size="small" label={detalle.tipo} color={detalle.tipo === 'REPUESTO' ? 'primary' : 'default'} /></TableCell>
                            <TableCell>{detalle.itemDetalleId}</TableCell>
                            <TableCell align="center">{detalle.cantidad}</TableCell>
                            <TableCell align="right">${formatMoney(detalle.valor)}</TableCell>
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
        </DialogActions>
      </Dialog>

      <FloatingScrollButtons />
    </Box>
  );
};
