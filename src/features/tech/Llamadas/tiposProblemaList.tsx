import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, TextField, Button, MenuItem, CircularProgress,
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

// --- INTERFACES ---
interface OrigenOption {
  originID: number;
  name: string;
}

interface TipoProblema {
  id: string;
  nombre: string;
  categoria: number;
  categoriaNombre: string;
}

export const TiposProblemaList = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Estados de datos
  const [problemas, setProblemas] = useState<TipoProblema[]>([]);
  const [origenes, setOrigenes] = useState<OrigenOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [filtros, setFiltros] = useState({ categoria: 'TODOS', nombre: '' });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(15);
  const [totalCount, setTotalCount] = useState(0);

  // Modal Crear/Editar
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ nombre: '', categoria: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal Eliminar
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrigenes = async () => {
      try {
        const res = await api.get('/sap/llamadaservicio/origenlls?top=20&skip=0');
        setOrigenes(res.data.registros || res.data || []);
      } catch (error) {
        console.error("Error cargando categorías:", error);
        toast.error("Error al cargar las categorías (Orígenes).");
      }
    };
    fetchOrigenes();
    cargarProblemas(0, 15); // Carga inicial
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cargarProblemas = async (currentPage = page, currentLimit = rowsPerPage) => {
    setIsLoading(true);
    try {
      const skip = currentPage * currentLimit;
      let url = `/tipos-problema-st?top=${currentLimit}&skip=${skip}`;
      let res;

      // Si hay filtro por nombre (Prioridad 1)
      if (filtros.nombre.trim().length > 0) {
        url = `/tipos-problema-st/pornombre?nombre=${encodeURIComponent(filtros.nombre)}&top=${currentLimit}&skip=${skip}`;
        res = await api.get(url);
        let data: TipoProblema[] = Array.isArray(res.data) ? res.data : (res.data.registros || res.data.items || []);
        
        if (filtros.categoria !== 'TODOS') {
          data = data.filter(p => String(p.categoria) === String(filtros.categoria));
        }
        setProblemas(data);
        setTotalCount(res.data.count || data.length);
      } 
      else if (filtros.categoria !== 'TODOS') {
        url = `/tipos-problema-st/porcategoria?categoria=${filtros.categoria}&top=${currentLimit}&skip=${skip}`;
        res = await api.get(url);
        setProblemas(Array.isArray(res.data) ? res.data : (res.data.registros || []));
        setTotalCount(res.data.count || res.data.length || 0);
      } 
      // Sin filtros (General)
      else {
        res = await api.get(url);
        setProblemas(Array.isArray(res.data) ? res.data : (res.data.registros || []));
        setTotalCount(res.data.count || res.data.length || 0);
      }
    } catch (error) {
      console.error("Error al cargar problemas:", error);
      toast.error("Error al cargar la lista de problemas.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyFilters = () => {
    setPage(0);
    cargarProblemas(0, rowsPerPage);
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
    cargarProblemas(newPage, rowsPerPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newRows = parseInt(event.target.value, 10);
    setRowsPerPage(newRows);
    setPage(0);
    cargarProblemas(0, newRows);
  };

  // 3. Manejo de Modales
  const handleOpenCreate = () => {
    setIsEditing(false);
    setCurrentId(null);
    setFormData({ nombre: '', categoria: filtros.categoria !== 'TODOS' ? filtros.categoria : '' });
    setModalOpen(true);
  };

  const handleOpenEdit = (problema: TipoProblema) => {
    setIsEditing(true);
    setCurrentId(problema.id);
    setFormData({ nombre: problema.nombre, categoria: String(problema.categoria) });
    setModalOpen(true);
  };

  const confirmDelete = (id: string) => {
    setItemToDelete(id);
    setDeleteModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.nombre.trim()) return toast.warning("El nombre es obligatorio.");
    if (!formData.categoria) return toast.warning("Debes seleccionar una categoría.");

    setIsSubmitting(true);
    try {
      const payload = {
        nombre: formData.nombre,
        categoria: Number(formData.categoria)
      };

      if (isEditing && currentId) {
        await api.put(`/tipos-problema-st/${encodeURIComponent(currentId)}`, payload);
        toast.success("Problema actualizado correctamente.");
      } else {
        await api.post(`/tipos-problema-st`, payload);
        toast.success("Problema creado exitosamente.");
      }
      
      setModalOpen(false);
      cargarProblemas(page, rowsPerPage);
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
      await api.delete(`/tipos-problema-st/${encodeURIComponent(itemToDelete)}`);
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
          <Grid size={{ xs: 12, sm: 4, md: 4 }}>
            <TextField 
              select label="Filtrar por Categoría (Origen)" fullWidth size="small" 
              value={filtros.categoria} onChange={(e) => setFiltros({ ...filtros, categoria: e.target.value })}
            >
              <MenuItem value="TODOS">Todas las Categorías</MenuItem>
              {origenes.map(o => <MenuItem key={o.originID} value={o.originID}>{o.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 5, md: 5 }}>
            <TextField 
              label="Buscar por Nombre" fullWidth size="small" 
              placeholder="Ej. Motor Quemado"
              value={filtros.nombre} onChange={(e) => setFiltros({ ...filtros, nombre: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 3, md: 3 }}>
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
                      <Typography variant="body2" color="text.secondary" mb={2}>
                        <strong>Categoría:</strong> {prob.categoriaNombre}
                      </Typography>
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
                    <TableCell>Categoría (Origen)</TableCell>
                    <TableCell align="right">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {problemas.map((prob) => (
                    <TableRow key={prob.id} hover>
                      <TableCell sx={{ fontWeight: 'bold' }}>{prob.id}</TableCell>
                      <TableCell>{prob.nombre}</TableCell>
                      <TableCell><Chip size="small" label={prob.categoriaNombre} color="info" variant="outlined" /></TableCell>
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
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[15, 30, 50]}
            labelRowsPerPage="Filas por página"
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
            <Grid size={{ xs: 12 }}>
              <TextField 
                select label="Categoría (Origen)" fullWidth size="small" 
                value={formData.categoria} onChange={(e) => setFormData({...formData, categoria: e.target.value})}
              >
                {origenes.map(o => <MenuItem key={o.originID} value={o.originID}>{o.name}</MenuItem>)}
              </TextField>
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

    </Box>
  );
};
