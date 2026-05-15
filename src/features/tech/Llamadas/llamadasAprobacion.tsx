import { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, Chip, IconButton, CircularProgress, Dialog, 
  DialogTitle, DialogContent, DialogActions, Avatar, Button, TextField, Grid,
  useMediaQuery, Card, CardContent, Stack, TablePagination
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { toast } from 'sonner';

import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import VisibilityIcon from '@mui/icons-material/Visibility';
import FilterAltIcon from '@mui/icons-material/FilterAlt';

import api from '../../../services/api';
import { TECH_ENDPOINTS } from '../../../services/endpoints/tech';
import { type LlamadaServicio } from './llamadasSlice';
import { useAppSelector } from '../../../app/hooks';
import { selectCurrentUser } from '../../auth/authSlice';
import { useNavigate } from 'react-router-dom';
import { FloatingScrollButtons } from '../../../components/layout/FloatingScrollButtons';

const getOneMonthAgoDate = () => {
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  return date.toISOString().split('T')[0]; 
};

const formatNroOS = (llamada: LlamadaServicio) => {
  return llamada.nroDocumento ? String(llamada.nroDocumento) : `Borrador #${llamada.id}`;
};

const PAGE_SIZE = 15;
const SOLUCIONES_AUTORIZABLES = ['REPARACION', 'MANTENIMIENTO'];
const SOLUCIONES_NEGABLES = ['REPOSICION', 'NOTA DE CREDITO', 'NO CUBRE GARANTIA'];

const normalizeSolucion = (value?: string | null) =>
  (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();

const canAutorizarBySolucion = (value?: string | null) => SOLUCIONES_AUTORIZABLES.includes(normalizeSolucion(value));

const canNegarBySolucion = (value?: string | null) => SOLUCIONES_NEGABLES.includes(normalizeSolucion(value));

const getSolucionDecisionError = (accion: 'AUTORIZAR' | 'NEGAR', value?: string | null) => {
  if (accion === 'AUTORIZAR' && !canAutorizarBySolucion(value)) {
    return 'Solo se puede autorizar una OS con Solución (Esperada) REPARACION o MANTENIMIENTO.';
  }
  if (accion === 'NEGAR' && !canNegarBySolucion(value)) {
    return 'Para negar la OS debes cambiar la Solución (Esperada) a REPOSICION, NOTA DE CREDITO o NO CUBRE GARANTIA.';
  }
  return '';
};

export const LlamadasAprobacion = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const navigate = useNavigate();
  const user = useAppSelector(selectCurrentUser);
  
  const [llamadas, setLlamadas] = useState<LlamadaServicio[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const [filtros, setFiltros] = useState({
    fechaDesde: getOneMonthAgoDate(),
    fechaHasta: ''
  });

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [selectedOsId, setSelectedOsId] = useState<number | null>(null);

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [comentariosNegacion, setComentariosNegacion] = useState('');

  const cargarAprobaciones = async (currentPage = page) => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('pagina', String(currentPage + 1));
      queryParams.append('recordsPorPagina', String(PAGE_SIZE));
      queryParams.append('estado', 'P'); 
      
      if (filtros.fechaDesde) queryParams.append('fechaDesde', filtros.fechaDesde);
      if (filtros.fechaHasta) queryParams.append('fechaHasta', filtros.fechaHasta);

      const res = await api.get<LlamadaServicio[]>(`${TECH_ENDPOINTS.GET_LLAMADAS}?${queryParams.toString()}`);
      
      const filtradas = res.data.filter(os => (os.nroDetallesServicio || 0) >= 0);
      setLlamadas(filtradas.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()));
      setTotalCount(currentPage * PAGE_SIZE + filtradas.length + (filtradas.length === PAGE_SIZE ? 1 : 0));
    } catch (error) {
      console.error(error);
      toast.error("Error al cargar la bandeja de aprobaciones");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.ubicacion !== '05-FT1') {
      toast.error("No tienes permisos para ver esta bandeja");
      navigate('/tech/llamadas');
      return;
    }
    cargarAprobaciones();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, navigate]);

  const handleApplyFilters = () => {
    setPage(0);
    cargarAprobaciones(0);
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
    cargarAprobaciones(newPage);
  };

  const getLlamadaForDecision = async (id: number) => {
    const selectedLlamada = llamadas.find((llamada) => llamada.id === id);
    if (selectedLlamada?.prioridad) return selectedLlamada;
    const res = await api.get<LlamadaServicio>(TECH_ENDPOINTS.GET_LLAMADA_BY_ID(id));
    return res.data;
  };

  const openAuthModal = async (id: number) => {
    const selectedLlamada = await getLlamadaForDecision(id);
    const solucionError = getSolucionDecisionError('AUTORIZAR', selectedLlamada?.prioridad);
    if (solucionError) {
      toast.warning(solucionError);
      return;
    }
    setSelectedOsId(id);
    setAuthModalOpen(true);
  };

  const handleAutorizar = async () => {
    if (!selectedOsId) return;
    const selectedLlamada = await getLlamadaForDecision(selectedOsId);
    const solucionError = getSolucionDecisionError('AUTORIZAR', selectedLlamada?.prioridad);
    if (solucionError) {
      toast.warning(solucionError);
      return;
    }
    try {
      await api.patch(TECH_ENDPOINTS.PATCH_LLAMADA_ESTADO(selectedOsId), { estado: 'A' });
      await api.post(TECH_ENDPOINTS.POST_SAP_LLAMADA(selectedOsId), {});
      await api.patch(TECH_ENDPOINTS.PATCH_SAP_LLAMADA_ESTADO(selectedOsId), { estado: 'A' });

      toast.success(`Orden #${selectedOsId} Autorizada correctamente en SQL y SAP`);
      setLlamadas(llamadas.filter(ll => ll.id !== selectedOsId)); 
    } catch (error) {
      console.error(error);
      toast.error("Error al autorizar la orden");
    } finally {
      setAuthModalOpen(false);
      setSelectedOsId(null);
    }
  };

  const openRejectModal = async (id: number) => {
    const selectedLlamada = await getLlamadaForDecision(id);
    const solucionError = getSolucionDecisionError('NEGAR', selectedLlamada?.prioridad);
    if (solucionError) {
      toast.warning(solucionError);
      return;
    }
    setSelectedOsId(id);
    setComentariosNegacion('');
    setRejectModalOpen(true);
  };

  const handleNegar = async () => {
    if (!selectedOsId) return;
    const selectedLlamada = await getLlamadaForDecision(selectedOsId);
    const solucionError = getSolucionDecisionError('NEGAR', selectedLlamada?.prioridad);
    if (solucionError) {
      toast.warning(solucionError);
      return;
    }
    try {
      await api.patch(TECH_ENDPOINTS.PATCH_LLAMADA_ESTADO(selectedOsId), { estado: 'N' });
      toast.info(`Orden #${selectedOsId} ha sido Denegada (N)`);
      setLlamadas(llamadas.filter(ll => ll.id !== selectedOsId));
    } catch (error) {
      console.error(error);
      toast.error("Error al denegar la orden");
    } finally {
      setRejectModalOpen(false);
      setSelectedOsId(null);
    }
  };

  return (
    <Box sx={{ pb: 4, maxWidth: 1200, margin: '0 auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
        <Avatar sx={{ bgcolor: 'warning.main', width: 56, height: 56 }}><FactCheckIcon fontSize="large" /></Avatar>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 'bold' }}>Bandeja de Autorizaciones</Typography>
          <Typography variant="body2" color="text.secondary">Órdenes pendientes de revisión central (05-FT1)</Typography>
        </Box>
      </Box>

      <Paper sx={{ p: { xs: 2, md: 3 }, mb: 3, borderRadius: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, sm: 4, md: 4 }}>
            <TextField 
              label="Fecha Desde" type="date" fullWidth size="small" InputLabelProps={{ shrink: true }} 
              value={filtros.fechaDesde} onChange={(e) => setFiltros({ ...filtros, fechaDesde: e.target.value })} 
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4, md: 4 }}>
            <TextField 
              label="Fecha Hasta" type="date" fullWidth size="small" InputLabelProps={{ shrink: true }} 
              value={filtros.fechaHasta} onChange={(e) => setFiltros({ ...filtros, fechaHasta: e.target.value })} 
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Button variant="contained" color="primary" fullWidth startIcon={<FilterAltIcon />} onClick={handleApplyFilters} sx={{ height: '40px' }}>
              Filtrar Pendientes
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 10 }}><CircularProgress /></Box>
      ) : llamadas.length === 0 ? (
        <Paper sx={{ p: 5, textAlign: 'center', borderRadius: 2 }}>
          <Typography variant="h6" color="text.secondary">¡Excelente trabajo!</Typography>
          <Typography color="text.secondary">No hay órdenes listas para autorización en este rango de fechas.</Typography>
        </Paper>
      ) : isMobile ? (
        <Stack spacing={2}>
          {llamadas.map((llamada) => (
            <Card key={llamada.id} variant="outlined" sx={{ borderRadius: 2, borderColor: 'warning.main', borderLeft: 6 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="subtitle1" fontWeight="bold" color="primary">OS {formatNroOS(llamada)}</Typography>
                  <Chip label={llamada.ubicacion} size="small" variant="outlined" />
                </Box>
                <Typography variant="body2" color="text.secondary" mb={0.5}><strong>Fecha:</strong> {llamada.fecha.split('T')[0]}</Typography>
                <Typography variant="body2" color="text.secondary" mb={0.5}><strong>Cliente:</strong> {llamada.clienteId}</Typography>
                <Typography variant="body2" color="text.secondary" mb={2}>
                  <strong>Ítems Solicitados:</strong> <Chip label={`${llamada.nroDetallesServicio || 0} detalles`} color="info" size="small" sx={{ ml: 1, height: 20 }} />
                </Typography>
                
                <Grid container spacing={1}>
                  <Grid size={{ xs: 12 }}>
                    <Button fullWidth variant="outlined" color="info" startIcon={<VisibilityIcon />} onClick={() => navigate(`/tech/llamadas/${llamada.id}/edit`)}>
                      Revisar Detalles Completos
                    </Button>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Button fullWidth variant="contained" color="success" startIcon={<CheckCircleIcon />} onClick={() => openAuthModal(llamada.id)}>
                      Autorizar
                    </Button>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Button fullWidth variant="contained" color="error" startIcon={<CancelIcon />} onClick={() => openRejectModal(llamada.id)}>
                      Negar
                    </Button>
                  </Grid>
                </Grid>
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
                <TableCell>Origen (Bodega)</TableCell>
                <TableCell>Fecha</TableCell>
                <TableCell>Cliente</TableCell>
                <TableCell align="center">Ítems Solicitados</TableCell>
                <TableCell align="center">Decisión</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {llamadas.map((llamada) => (
                <TableRow key={llamada.id} hover>
                  <TableCell sx={{ fontWeight: 'bold' }}>{formatNroOS(llamada)}</TableCell>
                  <TableCell><Chip label={llamada.ubicacion} size="small" variant="outlined" /></TableCell>
                  <TableCell>{llamada.fecha.split('T')[0]}</TableCell>
                  <TableCell>{llamada.clienteId}</TableCell>
                  <TableCell align="center">
                    <Chip label={`${llamada.nroDetallesServicio || 0} detalles`} color="info" size="small" />
                  </TableCell>
                  <TableCell align="center">
                    <IconButton color="info" title="Revisar Detalles" onClick={() => navigate(`/tech/llamadas/${llamada.id}/edit`)}>
                      <VisibilityIcon />
                    </IconButton>
                    <IconButton color="success" title="Autorizar" onClick={() => openAuthModal(llamada.id)}>
                      <CheckCircleIcon />
                    </IconButton>
                    <IconButton color="error" title="Negar" onClick={() => openRejectModal(llamada.id)}>
                      <CancelIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {llamadas.length > 0 && (
        <TablePagination
          component="div"
          count={totalCount}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={PAGE_SIZE}
          rowsPerPageOptions={[]}
          labelRowsPerPage=""
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
        />
      )}

      {/* --- MODALES --- */}
      <Dialog open={authModalOpen} onClose={() => setAuthModalOpen(false)}>
        <DialogTitle sx={{ fontWeight: 'bold', color: 'success.main', display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckCircleIcon /> Confirmar Autorización
        </DialogTitle>
        <DialogContent dividers>
          <Typography>¿Está seguro de autorizar la Orden de Servicio <strong>#{selectedOsId}</strong>?</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Esta acción creará la orden en SAP con estado Autorizada (A) y notificará al técnico de origen.</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setAuthModalOpen(false)} color="inherit">Cancelar</Button>
          <Button onClick={handleAutorizar} variant="contained" color="success">Autorizar Orden</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={rejectModalOpen} onClose={() => setRejectModalOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 'bold', color: 'error.main', display: 'flex', alignItems: 'center', gap: 1 }}>
          <CancelIcon /> Negar Orden de Servicio
        </DialogTitle>
        <DialogContent dividers>
          <Typography sx={{ mb: 2 }}>¿Está seguro de denegar la Orden <strong>#{selectedOsId}</strong>? Esta acción es irreversible y bloqueará la edición para el técnico.</Typography>
          <TextField 
            label="Comentarios de rechazo (Opcional)" 
            fullWidth 
            multiline 
            rows={3} 
            value={comentariosNegacion} 
            onChange={(e) => setComentariosNegacion(e.target.value)} 
            placeholder="Ej. Falta adjuntar la factura del equipo..."
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setRejectModalOpen(false)} color="inherit">Cancelar</Button>
          <Button onClick={handleNegar} variant="contained" color="error">Denegar Orden</Button>
        </DialogActions>
      </Dialog>
      <FloatingScrollButtons />
    </Box>
  );
};
