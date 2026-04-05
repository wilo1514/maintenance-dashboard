import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, IconButton, TextField, 
  MenuItem, Chip, Grid, Button, useMediaQuery, Card, CardContent, 
  CardActions, Stack, Divider, Pagination,
  Dialog, DialogTitle, DialogContent, DialogActions, List, ListItem, ListItemText, CircularProgress
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';

import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { selectAllTransfers, selectTransfersLoading, selectTransfersTotalPages, fetchTransfers, type Transfer } from './transfersSlice';
import { fetchTransferItems, selectTransferItems, selectItemsLoading, clearItems } from './Transfers/transferItemsSlice';
import { selectCurrentUser } from '../auth/authSlice';
import { useNavigate } from 'react-router-dom';

const getOneMonthAgoDate = () => {
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  return date.toISOString().split('T')[0]; 
};

export const TransferList = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  
  const user = useAppSelector(selectCurrentUser);
  const isFT1 = user?.ubicacion === '05-FT1';

  const transfers = useAppSelector(selectAllTransfers);
  const isLoading = useAppSelector(selectTransfersLoading);
  const totalPages = useAppSelector(selectTransfersTotalPages);

  const viewItems = useAppSelector(selectTransferItems);
  const isViewItemsLoading = useAppSelector(selectItemsLoading);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [tempFilters, setTempFilters] = useState({ 
    fechaDesde: getOneMonthAgoDate(), 
    fechaHasta: '', 
    numero: '', 
    tipo: 'TODOS', 
    estado: 'TODOS' 
  });
  
  const [appliedFilters, setAppliedFilters] = useState(tempFilters);
  const [page, setPage] = useState(1);
  const itemsPerPage = 15; 

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);

  useEffect(() => {
    dispatch(fetchTransfers({ page, limit: itemsPerPage, ...appliedFilters }));
  }, [dispatch, page, appliedFilters]);

  const handleApplyFilters = () => {
    setAppliedFilters(tempFilters);
    setPage(1); 
  };

  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number) => setPage(value);

// --- NUEVA LÓGICA DE NAVEGACIÓN ---
  const handleModify = (transfer: Transfer) => {
    const isDraftFT1 = isFT1 && !transfer.nroInterno && !transfer.nroDocumento;
    
    if (isDraftFT1) {
      // Si es FT1 y es un borrador (no ha ido a SAP), va al constructor para agregar/quitar ítems
      navigate(`/tech/transfers/edit/${transfer.idReal}`);
    } else {
      // Si es receptor, va a la pantalla de validación de cantidades
      navigate(`/tech/transfers/${transfer.idReal}/items`);
    }
  };

  
  const handleCreateTransfer = () => navigate('/tech/transfers/new'); // NUEVA RUTA PARA CREAR

  const handleOpenViewModal = (transfer: Transfer) => {
    setSelectedTransfer(transfer);
    setModalOpen(true);
    dispatch(fetchTransferItems(transfer.id));
  };

  const handleCloseViewModal = () => {
    setModalOpen(false);
    setSelectedTransfer(null);
    dispatch(clearItems());
  };

  const getStatusColor = (estado: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    switch (estado) {
      case 'PENDIENTE': return 'warning';
      case 'APROBADO': return 'success';
      default: return 'default';
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 'bold' }}>Transferencias</Typography>
          <Typography variant="body2" color="text.secondary">Gestión y consulta de transferencias de inventario</Typography>
        </Box>
        {/* BOTÓN DE CREAR SOLO PARA 05-FT1 */}
        {isFT1 && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreateTransfer} sx={{ width: { xs: '100%', sm: 'auto' } }}>
            Nueva Transferencia
          </Button>
        )}
      </Box>

      {/* --- ZONA DE FILTROS --- */}
      <Paper sx={{ p: { xs: 2, md: 3 }, mb: 3, borderRadius: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 6, md: 2 }}>
            <TextField id="filtro-desde" label="Desde" type="date" fullWidth size="small" InputLabelProps={{ shrink: true }} value={tempFilters.fechaDesde} onChange={(e) => setTempFilters({ ...tempFilters, fechaDesde: e.target.value })} />
          </Grid>
          <Grid size={{ xs: 6, md: 2 }}>
            <TextField id="filtro-hasta" label="Hasta" type="date" fullWidth size="small" InputLabelProps={{ shrink: true }} value={tempFilters.fechaHasta} onChange={(e) => setTempFilters({ ...tempFilters, fechaHasta: e.target.value })} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <TextField id="filtro-numero" label="Nro. Transferencia" fullWidth size="small" autoComplete="off" value={tempFilters.numero} onChange={(e) => setTempFilters({ ...tempFilters, numero: e.target.value })} />
          </Grid>
          <Grid size={{ xs: 6, sm: 6, md: 2 }}>
            <TextField select label="Tipo" fullWidth size="small" value={tempFilters.tipo} onChange={(e) => setTempFilters({ ...tempFilters, tipo: e.target.value })}>
              <MenuItem value="TODOS">Todos</MenuItem>
              <MenuItem value="SAP">SAP</MenuItem>
              <MenuItem value="TRF">TRF</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 6, sm: 6, md: 2 }}>
            <TextField select label="Estado" fullWidth size="small" value={tempFilters.estado} onChange={(e) => setTempFilters({ ...tempFilters, estado: e.target.value })}>
              <MenuItem value="TODOS">Todos</MenuItem>
              <MenuItem value="P">PENDIENTE</MenuItem>
              <MenuItem value="A">APROBADO</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <Button variant="contained" fullWidth startIcon={<FilterAltIcon />} onClick={handleApplyFilters} sx={{ height: '40px' }}>Aplicar</Button>
          </Grid>
        </Grid>
      </Paper>

      {/* --- LISTADO (VISTA DUAL) --- */}
      {isMobile ? (
        <Stack spacing={2} sx={{ mb: 3 }}>
          {isLoading ? (
            <Typography align="center" sx={{ py: 3 }}>Cargando transferencias...</Typography>
          ) : transfers.length === 0 ? (
            <Typography align="center" color="textSecondary" sx={{ py: 3 }}>No se encontraron resultados.</Typography>
          ) : (
            transfers.map((transfer) => {
              // REGLA DINÁMICA DE MODIFICACIÓN
              const canModify = isFT1 
                ? (!transfer.nroInterno && !transfer.nroDocumento) // FT1 solo edita si no se ha enviado a SAP
                : transfer.estado === 'PENDIENTE';                 // Receptores editan si está pendiente

              return (
                <Card key={transfer.id} elevation={3} sx={{ borderRadius: 2 }}>
                  <CardContent sx={{ pb: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="subtitle1" fontWeight="bold" color="primary">#{transfer.numero}</Typography>
                      <Chip size="small" color={getStatusColor(transfer.estado)} label={transfer.estado} />
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}><strong>Fecha:</strong> {transfer.fecha}</Typography>
                    <Typography variant="body2" color="text.secondary"><strong>Tipo:</strong> {transfer.tipo}</Typography>
                  </CardContent>
                  <Divider />
                  <CardActions sx={{ justifyContent: 'flex-end', pt: 0.5, pb: 0.5 }}>
                    <Button size="small" startIcon={<VisibilityIcon />} onClick={() => handleOpenViewModal(transfer)}>Ver</Button>
                    <Button 
                      size="small" color="secondary" startIcon={<ArrowForwardIcon />} 
                      onClick={() => handleModify(transfer)}  // <-- AQUÍ: Le pasamos 'transfer' completo
                    >
                      {canModify ? (isFT1 ? 'Continuar Edición' : 'Gestionar Items') : 'Procesada'}
                    </Button>
                  </CardActions>
                </Card>
              );
            })
          )}
        </Stack>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead sx={{ backgroundColor: 'action.hover' }}>
              <TableRow>
                <TableCell>Nro. Transferencia</TableCell>
                <TableCell>Orden / Ref.</TableCell>
                <TableCell>Fecha</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 3 }}>Cargando transferencias...</TableCell></TableRow>
              ) : transfers.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 3 }}>No se encontraron resultados.</TableCell></TableRow>
              ) : (
                transfers.map((transfer) => {
                  const canModify = isFT1 
                    ? (!transfer.nroInterno && !transfer.nroDocumento)
                    : transfer.estado === 'PENDIENTE';

                  return (
                    <TableRow key={transfer.id} hover>
                      <TableCell sx={{ fontWeight: 'bold' }}>{transfer.numero}</TableCell>
                      <TableCell>
                        {transfer.ordenMantenimiento ? <Chip size="small" variant="outlined" color="primary" label={transfer.ordenMantenimiento} /> : <Typography variant="caption" color="text.disabled">-</Typography>}
                      </TableCell>
                      <TableCell>{transfer.fecha}</TableCell>
                      <TableCell><Chip size="small" variant="outlined" label={transfer.tipo} /></TableCell>
                      <TableCell><Chip size="small" color={getStatusColor(transfer.estado)} label={transfer.estado} /></TableCell>
                      <TableCell align="right">
                        <IconButton color="info" onClick={() => handleOpenViewModal(transfer)} title="Ver Detalles">
                          <VisibilityIcon />
                        </IconButton>
                        <IconButton 
                        color={canModify ? "secondary" : "default"} 
                        onClick={() => handleModify(transfer)}  // <-- AQUÍ: Le pasamos 'transfer' completo
                        title={canModify ? (isFT1 ? "Continuar Edición" : "Gestionar Items") : "Transferencia Oficializada"}
                        disabled={!canModify}
                      >
                        <ArrowForwardIcon />
                      </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {!isLoading && totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, mb: 2 }}>
          <Pagination count={totalPages} page={page} onChange={handlePageChange} color="primary" size={isMobile ? "small" : "medium"} />
        </Box>
      )}

      {/* MODAL POP-UP DE VISTA (SE MANTIENE IGUAL) */}
      <Dialog open={modalOpen} onClose={handleCloseViewModal} maxWidth="md" fullWidth fullScreen={isMobile}>
        {/* ... (Todo el contenido del modal de vista se mantiene intacto) ... */}
        <DialogTitle sx={{ m: 0, p: 2, backgroundColor: 'primary.main', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" fontWeight="bold">Detalle de Transferencia</Typography>
          <IconButton onClick={handleCloseViewModal} sx={{ color: 'white' }}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: { xs: 0, md: 2 }, backgroundColor: '#f5f5f5' }}>
          {selectedTransfer && (
            <Box sx={{ p: 2, mb: 2, backgroundColor: 'white', borderRadius: { xs: 0, md: 1 }, boxShadow: { xs: 0, md: 1 } }}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Typography variant="caption" color="text.secondary">Nro. Transferencia</Typography>
                  <Typography variant="body2" fontWeight="bold">{selectedTransfer.numero}</Typography>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Typography variant="caption" color="text.secondary">Fecha</Typography>
                  <Typography variant="body2">{selectedTransfer.fecha}</Typography>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Typography variant="caption" color="text.secondary" display="block">Estado</Typography>
                  <Chip size="small" color={getStatusColor(selectedTransfer.estado)} label={selectedTransfer.estado} />
                </Grid>
              </Grid>
            </Box>
          )}

          {isViewItemsLoading ? (
             <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
          ) : isMobile ? (
            <List sx={{ width: '100%', bgcolor: 'background.paper', p: 0 }}>
              {viewItems.length === 0 && <ListItem><ListItemText secondary="No hay ítems registrados." /></ListItem>}
              {viewItems.map((item, index) => (
                <React.Fragment key={item.id}>
                  <ListItem sx={{ py: 1.5 }}>
                    <ListItemText 
                      primary={<Typography variant="subtitle2" color="primary">{item.itemCode}</Typography>}
                      secondary={
                        <React.Fragment>
                          <Typography variant="body2" color="text.primary" display="block" sx={{ mb: 0.5 }}>{item.descripcion}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Cant. Pedida: <strong>{item.cantidadPedida}</strong>
                          </Typography>
                        </React.Fragment>
                      }
                    />
                  </ListItem>
                  {index < viewItems.length - 1 && <Divider component="li" />}
                </React.Fragment>
              ))}
            </List>
          ) : (
            <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e0e0e0' }}>
              <Table size="small">
                <TableHead sx={{ backgroundColor: 'action.hover' }}>
                  <TableRow>
                    <TableCell>Código</TableCell>
                    <TableCell>Descripción</TableCell>
                    <TableCell align="center">Cant. Pedida</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {viewItems.length === 0 && <TableRow><TableCell colSpan={3} align="center">No hay ítems registrados.</TableCell></TableRow>}
                  {viewItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell sx={{ fontWeight: 'bold', color: 'primary.main' }}>{item.itemCode}</TableCell>
                      <TableCell>{item.descripcion}</TableCell>
                      <TableCell align="center"><Chip label={item.cantidadPedida} size="small" variant="outlined" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleCloseViewModal} variant="contained" color="inherit">Cerrar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};