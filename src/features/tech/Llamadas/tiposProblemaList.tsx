import { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, TextField, Button, CircularProgress,
  IconButton, Avatar, TableContainer, Table, TableHead, TableRow, TableCell,
  TableBody, Dialog, DialogTitle, DialogContent, DialogActions, Chip,
  useMediaQuery, Card, CardContent, Stack, TablePagination
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { toast } from 'sonner';

import CategoryIcon from '@mui/icons-material/Category';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FilterAltIcon from '@mui/icons-material/FilterAlt';

import api from '../../../services/api';
import { TECH_ENDPOINTS } from '../../../services/endpoints/tech';
import { FloatingScrollButtons } from '../../../components/layout/FloatingScrollButtons';

interface TipoProblema {
  id: string;
  nombre: string;
}

const PAGE_SIZE = 15;

export const TiposProblemaList = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [problemas, setProblemas] = useState<TipoProblema[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [filtros, setFiltros] = useState({ nombre: '' });
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ nombre: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  useEffect(() => {
    cargarProblemas(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cargarProblemas = async (currentPage = page) => {
    setIsLoading(true);
    try {
      const skip = currentPage * PAGE_SIZE;
      const url = filtros.nombre.trim().length > 0
        ? `${TECH_ENDPOINTS.SEARCH_TIPOS_PROBLEMA_NOMBRE}?nombre=${encodeURIComponent(filtros.nombre)}&top=${PAGE_SIZE}&skip=${skip}`
        : `${TECH_ENDPOINTS.GET_TIPOS_PROBLEMA}?top=${PAGE_SIZE}&skip=${skip}`;
      const res = await api.get(url);
      const data = Array.isArray(res.data) ? res.data : (res.data.registros || res.data.items || []);
      setProblemas(data);
      const apiCount = typeof res.data?.count === 'number' ? res.data.count : 0;
      const optimisticCount = skip + data.length + (data.length === PAGE_SIZE ? 1 : 0);
      setTotalCount(Math.max(apiCount, optimisticCount));
    } catch (error) {
      console.error("Error al cargar problemas:", error);
      toast.error("Error al cargar la lista de problemas.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyFilters = () => {
    setPage(0);
    cargarProblemas(0);
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
    cargarProblemas(newPage);
  };

  // 3. Manejo de Modales
  const handleOpenCreate = () => {
    setIsEditing(false);
    setCurrentId(null);
    setFormData({ nombre: '' });
    setModalOpen(true);
  };

  const handleOpenEdit = (problema: TipoProblema) => {
    setIsEditing(true);
    setCurrentId(problema.id);
    setFormData({ nombre: problema.nombre });
    setModalOpen(true);
  };

  const confirmDelete = (id: string) => {
    setItemToDelete(id);
    setDeleteModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.nombre.trim()) return toast.warning("El nombre es obligatorio.");

    setIsSubmitting(true);
    try {
      const payload = { nombre: formData.nombre };

      if (isEditing && currentId) {
        await api.put(TECH_ENDPOINTS.PUT_TIPO_PROBLEMA(currentId), payload);
        toast.success("Problema actualizado correctamente.");
      } else {
        await api.post(TECH_ENDPOINTS.POST_TIPO_PROBLEMA, payload);
        toast.success("Problema creado exitosamente.");
      }

      setModalOpen(false);
      cargarProblemas(page);
    } catch (error) {
      console.error("Error al guardar:", error);
      toast.error("Error al guardar el problema.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const executeDelete = async () => {
    if (!itemToDelete) return;
    try {
      await api.delete(TECH_ENDPOINTS.DELETE_TIPO_PROBLEMA(itemToDelete));
      toast.success("Problema eliminado correctamente.");
      setProblemas(prev => prev.filter(p => p.id !== itemToDelete));

      // Ajustamos el count
      setTotalCount(prev => prev > 0 ? prev - 1 : 0);
    } catch (error) {
      console.error("Error al eliminar:", error);
      toast.error("No se pudo eliminar (es posible que esté en uso en una Orden de Servicio).");
    } finally {
      setDeleteModalOpen(false);
      setItemToDelete(null);
    }
  };

  return (
    <Box sx={{ pb: { xs: 10, md: 4 }, maxWidth: 1200, margin: '0 auto' }}>

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar sx={{ bgcolor: 'info.main' }}><CategoryIcon /></Avatar>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>Tipos de Problema</Typography>
            <Typography variant="body2" color="text.secondary">Clasificación para Órdenes de Servicio</Typography>
          </Box>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreate} sx={{ width: { xs: '100%', sm: 'auto' } }}>
          Crear Problema
        </Button>
      </Box>

      {/* --- FILTROS --- */}
      <Paper sx={{ p: { xs: 2, md: 3 }, mb: 3, borderRadius: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, sm: 8, md: 9 }}>
            <TextField
              label="Buscar por Nombre" fullWidth size="small"
              placeholder="Ej. Motor Quemado"
              value={filtros.nombre} onChange={(e) => setFiltros({ ...filtros, nombre: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4, md: 3 }}>
            <Button variant="contained" color="primary" fullWidth startIcon={<FilterAltIcon />} onClick={handleApplyFilters} sx={{ height: '40px' }}>
              Buscar
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* --- LISTADO --- */}
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>
      ) : problemas.length === 0 ? (
        <Paper sx={{ p: 5, textAlign: 'center', borderRadius: 2 }}>
          <Typography color="text.secondary">No se encontraron problemas con estos filtros.</Typography>
        </Paper>
      ) : (
        <Paper sx={{ borderRadius: 2 }}>
          {isMobile ? (
            <Box sx={{ p: 2 }}>
              <Stack spacing={2}>
                {problemas.map((prob) => (
                  <Card key={prob.id} elevation={1} sx={{ borderRadius: 2, borderLeft: 6, borderColor: 'info.main' }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                        <Typography variant="subtitle1" fontWeight="bold" color="primary">{prob.nombre}</Typography>
                        <Chip size="small" label={prob.id} variant="outlined" sx={{ fontSize: '0.65rem' }} />
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                        <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={() => handleOpenEdit(prob)}>Editar</Button>
                        <IconButton color="error" size="small" onClick={() => confirmDelete(prob.id)}><DeleteOutlineIcon /></IconButton>
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </Box>
          ) : (
            // VISTA ESCRITORIO: Tabla
            <TableContainer>
              <Table>
                <TableHead sx={{ backgroundColor: 'action.hover' }}>
                  <TableRow>
                    <TableCell>Código ID</TableCell>
                    <TableCell>Nombre del Problema</TableCell>
                    <TableCell align="right">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {problemas.map((prob) => (
                    <TableRow key={prob.id} hover>
                      <TableCell sx={{ fontWeight: 'bold' }}>{prob.id}</TableCell>
                      <TableCell>{prob.nombre}</TableCell>
                      <TableCell align="right">
                        <IconButton color="primary" onClick={() => handleOpenEdit(prob)}><EditIcon /></IconButton>
                        <IconButton color="error" onClick={() => confirmDelete(prob.id)}><DeleteOutlineIcon /></IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          <TablePagination
            component="div"
            count={totalCount}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={PAGE_SIZE}
            rowsPerPageOptions={[]}
            labelRowsPerPage=""
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count !== -1 ? count : `más de ${to}`}`}
          />
        </Paper>
      )}

      {/* --- MODAL CREAR/EDITAR --- */}
      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>
          {isEditing ? 'Editar Problema' : 'Crear Nuevo Problema'}
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            {isEditing && (
               <Grid size={{ xs: 12 }}>
                 <TextField label="Código ID" value={currentId} disabled fullWidth size="small" />
               </Grid>
            )}
            <Grid size={{ xs: 12 }}>
              <TextField
                label="Nombre del Problema" fullWidth size="small" autoFocus
                value={formData.nombre} onChange={(e) => setFormData({...formData, nombre: e.target.value})}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setModalOpen(false)} color="inherit" disabled={isSubmitting}>Cancelar</Button>
          <Button onClick={handleSubmit} variant="contained" color="primary" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* --- MODAL ELIMINAR --- */}
      <Dialog open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)}>
        <DialogTitle sx={{ fontWeight: 'bold', color: 'error.main' }}>Eliminar Problema</DialogTitle>
        <DialogContent>
          <Typography>¿Estás seguro de que deseas eliminar este problema de la base de datos? Esta acción no se puede deshacer.</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteModalOpen(false)} color="inherit">Cancelar</Button>
          <Button onClick={executeDelete} variant="contained" color="error">Eliminar</Button>
        </DialogActions>
      </Dialog>

      <FloatingScrollButtons />
    </Box>
  );
};
