import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Box, Typography, Paper, IconButton, Chip, Grid, Divider, Button, 
  useMediaQuery, Stack, Card, CardContent, CardActions, TextField, 
  Switch, FormControlLabel, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, CircularProgress
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import { toast } from 'sonner';

import { useAppDispatch, useAppSelector } from '../../../app/hooks';

// IMPORTAMOS DE LA RUTA CORRECTA (Ajusta los ../ según tu estructura de carpetas)
import { 
  fetchTransferItems, selectTransferItems, selectTransferHeader, selectItemsLoading, 
  acceptTransfer, selectIsSubmitting, type TransferItem, clearItems
} from '../transferItemsSlice.ts';

export const TransferItems = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // 1. TRAEMOS LOS DATOS DESDE REDUX
  const transferHeader = useAppSelector(selectTransferHeader);
  const reduxItems = useAppSelector(selectTransferItems);
  const isItemsLoading = useAppSelector(selectItemsLoading);
  const isSubmitting = useAppSelector(selectIsSubmitting);

  // 2. ESTADO LOCAL PARA EDITAR LOS ÍTEMS ANTES DE GUARDAR
  const [localItems, setLocalItems] = useState<TransferItem[]>([]);

  // 3. EFECTO DE CARGA Y LIMPIEZA
  useEffect(() => {
    if (id) dispatch(fetchTransferItems(id));
    return () => { dispatch(clearItems()); };
  }, [dispatch, id]);

  // Sincronizamos los datos del backend a nuestro estado local para editarlos
  useEffect(() => {
    setLocalItems(reduxItems);
  }, [reduxItems]);

  // --- FUNCIONES DE MODIFICACIÓN LOCAL ---
  const handleQuantityChange = (itemId: string, newQuantity: string) => {
    const val = parseInt(newQuantity);
    if (isNaN(val) || val < 0) return;
    setLocalItems(prev => prev.map(item => item.id === itemId ? { ...item, cantidadRecibida: val } : item));
  };

  const handleToggleAccept = (itemId: string) => {
    setLocalItems(prev => prev.map(item => item.id === itemId ? { ...item, isAccepted: !item.isAccepted } : item));
  };

  const handleDeleteItem = (itemId: string) => {
    setLocalItems(prev => prev.filter(item => item.id !== itemId));
    toast.info('Ítem removido de la lista');
  };

  // --- FUNCIÓN PARA ENVIAR AL SERVIDOR ---
  const handleSubmitTransfer = async () => {
    if (!transferHeader) return;
    
    if (localItems.length === 0) {
      toast.error('No puedes enviar una transferencia sin ítems.');
      return;
    }
    
    const unverifiedItems = localItems.filter(item => !item.isAccepted);
    if (unverifiedItems.length > 0) {
      toast.error('Debes verificar (encender el switch) todos los ítems de la lista antes de aceptar.');
      return;
    }

    try {
      // Enviamos cabecera y detalles al Thunk para que él decida si es POST o PUT
      await dispatch(acceptTransfer({ header: transferHeader, items: localItems })).unwrap();
      
      toast.success(transferHeader.id === 0 ? '¡Transferencia registrada con éxito!' : '¡Transferencia actualizada con éxito!');
      navigate('/tech/transfers');
    } catch (error) {
      toast.error(`${error}`);
    }
  };

  // --- AYUDANTE DE COLORES ---
  const getStatusColor = (estado: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    const estadoLimpio = (estado || '').toUpperCase(); // Salvavidas en caso de que estado sea null
    switch (estadoLimpio) {
      case 'PENDIENTE': return 'warning';
      case 'P': return 'warning'; // A veces el backend manda solo "P"
      case 'PROCESADA': return 'info';
      case 'FINALIZADA': return 'success';
      case 'CERRADO': return 'default';
      default: return 'primary';
    }
  };

  // --- RENDERIZADO CONDICIONAL ---
  if (isItemsLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 10 }}><CircularProgress /></Box>;
  }

  if (!transferHeader) {
    return (
      <Box sx={{ textAlign: 'center', mt: 5 }}>
        <Typography variant="h6" color="text.secondary" gutterBottom>No se encontró la transferencia o ocurrió un error al cargar.</Typography>
        <Button variant="contained" startIcon={<ArrowBackIcon />} onClick={() => navigate('/tech/transfers')}>Volver al listado</Button>
      </Box>
    );
  }

  return (
    <Box sx={{ pb: 8 }}> 
      
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={() => navigate('/tech/transfers')} sx={{ mr: 1, backgroundColor: 'background.paper', boxShadow: 1 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" sx={{ fontWeight: 'bold' }}>Validación de Ítems</Typography>
      </Box>

      {/* --- CABECERA (DATOS DEL TRANSFER_HEADER) --- */}
      <Paper sx={{ p: { xs: 2, md: 3 }, mb: 3, borderRadius: 2, borderLeft: '6px solid', borderColor: 'primary.main' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" color="text.secondary" display="block">Nro. Transferencia</Typography>
            {/* SALVAVIDAS: Muestra el nroDocumento, si es null muestra nroInterno, si ambos son null muestra 'Borrador' */}
            <Typography variant="body1" fontWeight="bold">{transferHeader.nroDocumento || transferHeader.nroInterno || 'Borrador'}</Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" color="text.secondary" display="block">Fecha</Typography>
            <Typography variant="body1">{transferHeader.fecha ? transferHeader.fecha.split('T')[0] : 'S/F'}</Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>Estado</Typography>
            <Chip size="small" color={getStatusColor(transferHeader.estado)} label={transferHeader.estado} />
          </Grid>
          
          {/* Muestra nroServicio solo si existe */}
          {transferHeader.nroServicio && (
            <Grid size={{ xs: 6, sm: 3 }}>
              <Typography variant="caption" color="text.secondary" display="block">Orden de Mantenimiento</Typography>
              <Typography variant="body1" color="primary" fontWeight="bold">{transferHeader.nroServicio}</Typography>
            </Grid>
          )}
        </Grid>
      </Paper>

      {/* --- LISTADO DE ÍTEMS EDITABLES --- */}
      {localItems.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
          <Typography color="text.secondary">No hay ítems en esta lista.</Typography>
        </Paper>
      ) : isMobile ? (
        // VISTA MÓVIL (TARJETAS)
        <Stack spacing={2}>
          {localItems.map((item) => (
            <Card key={item.id} elevation={2} sx={{ borderRadius: 2, border: item.isAccepted ? '2px solid #4caf50' : '1px solid #e0e0e0' }}>
              <CardContent sx={{ pb: 1 }}>
                <Typography variant="subtitle2" color="primary" fontWeight="bold">{item.itemCode}</Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>{item.descripcion}</Typography>
                
                <Grid container spacing={2} alignItems="center">
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="caption" color="text.secondary">Cant. Pedida</Typography>
                    <Typography variant="body1" fontWeight="bold">{item.cantidadPedida}</Typography>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <TextField 
                      label="Recibida" type="number" size="small" fullWidth
                      value={item.cantidadRecibida} onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                      sx={{ input: { textAlign: 'center', fontWeight: 'bold' } }}
                    />
                  </Grid>
                </Grid>
              </CardContent>
              <Divider />
              <CardActions sx={{ justifyContent: 'space-between', px: 2, py: 1, backgroundColor: item.isAccepted ? '#e8f5e9' : 'transparent' }}>
                <FormControlLabel
                  control={<Switch color="success" checked={item.isAccepted} onChange={() => handleToggleAccept(item.id)} />}
                  label={<Typography variant="body2" fontWeight="bold" color={item.isAccepted ? 'success.main' : 'text.secondary'}>{item.isAccepted ? 'Verificado' : 'Pendiente'}</Typography>}
                />
                <IconButton color="error" onClick={() => handleDeleteItem(item.id)}><DeleteOutlineIcon /></IconButton>
              </CardActions>
            </Card>
          ))}
        </Stack>
      ) : (
        // VISTA PC (TABLA)
        <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead sx={{ backgroundColor: 'action.hover' }}>
              <TableRow>
                <TableCell>Código</TableCell>
                <TableCell>Descripción</TableCell>
                <TableCell align="center">Pedida</TableCell>
                <TableCell align="center" sx={{ width: '150px' }}>Recibida</TableCell>
                <TableCell align="center">Verificado</TableCell>
                <TableCell align="right">Quitar</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {localItems.map((item) => (
                <TableRow key={item.id} sx={{ backgroundColor: item.isAccepted ? '#f1f8e9' : 'inherit' }}>
                  <TableCell sx={{ fontWeight: 'bold', color: 'primary.main' }}>{item.itemCode}</TableCell>
                  <TableCell>{item.descripcion}</TableCell>
                  <TableCell align="center">
                    <Chip label={item.cantidadPedida} size="small" />
                  </TableCell>
                  <TableCell align="center">
                    <TextField 
                      type="number" size="small" fullWidth
                      value={item.cantidadRecibida} onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                      inputProps={{ min: 0, style: { textAlign: 'center' } }}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Switch color="success" checked={item.isAccepted} onChange={() => handleToggleAccept(item.id)} />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton color="error" onClick={() => handleDeleteItem(item.id)}><DeleteOutlineIcon /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* --- PIE DE PÁGINA FIJO (BOTONES DE ACCIÓN) --- */}
      <Paper elevation={4} sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, p: 2, zIndex: 1000, borderTop: '1px solid #e0e0e0' }}>
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', maxWidth: '800px', margin: '0 auto' }}>
          <Button 
            variant="outlined" color="inherit" size="large" fullWidth={isMobile}
            startIcon={<CancelIcon />} onClick={() => navigate('/tech/transfers')} disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button 
            variant="contained" color="success" size="large" fullWidth={isMobile}
            startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : <CheckCircleIcon />} 
            onClick={handleSubmitTransfer} disabled={isSubmitting || localItems.length === 0}
          >
            {isSubmitting ? 'Procesando...' : 'Aceptar Transferencia'}
          </Button>
        </Box>
      </Paper>

    </Box>
  );
};