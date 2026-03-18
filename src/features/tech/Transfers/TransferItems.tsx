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

// 1. Importamos la info general de la transferencia del slice principal
import { selectAllTransfers } from '../transfersSlice';

// 2. Importamos todo lo relacionado a los ítems del NUEVO slice
import { 
  fetchTransferItems, selectTransferItems, selectItemsLoading, 
  acceptTransfer, selectIsSubmitting, type TransferItem, clearItems
} from '../transferItemsSlice';

export const TransferItems = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Traemos la info general de la transferencia (Cabecera)
  const transfers = useAppSelector(selectAllTransfers);
  const transfer = transfers.find(t => t.id === id);

  // Traemos los ítems desde Redux
  const reduxItems = useAppSelector(selectTransferItems);
  const isItemsLoading = useAppSelector(selectItemsLoading);
  const isSubmitting = useAppSelector(selectIsSubmitting);

  // ESTADO LOCAL: Aquí el usuario modifica las cosas antes de guardar
  const [localItems, setLocalItems] = useState<TransferItem[]>([]);

 useEffect(() => {
    if (id) dispatch(fetchTransferItems(id));
    
    // Limpieza al salir de la pantalla
    return () => { dispatch(clearItems()); };
  }, [dispatch, id]);

  // Cuando el servidor nos responde, copiamos los ítems a nuestro estado local para poder editarlos
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
    if (!id) return;
    
    // Validamos que al menos haya un ítem y todos estén marcados como aceptados/verificados
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
      // Enviamos al backend
      await dispatch(acceptTransfer({ transferId: id, items: localItems })).unwrap();
      toast.success('¡Transferencia validada y aceptada con éxito!');
      navigate('/tech/transfers'); // Volvemos al listado
    } catch (error) {
      console.error('Fallo en la validación:', error); 
      toast.error('Error al enviar la transferencia al servidor.');
    }
  };

  const getStatusColor = (estado: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    switch (estado) {
      case 'PENDIENTE': return 'warning';
      case 'APROBADO': return 'info';
      case 'LIQUIDADO': return 'success';
      case 'CERRADO': return 'default';
      default: return 'primary';
    }
  };

  if (!transfer) {
    return (
      <Box sx={{ textAlign: 'center', mt: 5 }}>
        <Typography variant="h6" color="text.secondary" gutterBottom>No se encontró la transferencia o se recargó la página.</Typography>
        <Button variant="contained" startIcon={<ArrowBackIcon />} onClick={() => navigate('/tech/transfers')}>Volver al listado</Button>
      </Box>
    );
  }

  return (
    <Box sx={{ pb: 8 }}> {/* pb: 8 para que el footer flotante no tape el contenido */}
      
      {/* --- CABECERA SUPERIOR --- */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={() => navigate('/tech/transfers')} sx={{ mr: 1, backgroundColor: 'background.paper', boxShadow: 1 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" sx={{ fontWeight: 'bold' }}>Validación de Ítems</Typography>
      </Box>

      <Paper sx={{ p: { xs: 2, md: 3 }, mb: 3, borderRadius: 2, borderLeft: '6px solid', borderColor: 'primary.main' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" color="text.secondary" display="block">Nro. Transferencia</Typography>
            <Typography variant="body1" fontWeight="bold">{transfer.numero}</Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" color="text.secondary" display="block">Fecha</Typography>
            <Typography variant="body1">{transfer.fecha}</Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>Estado</Typography>
            <Chip size="small" color={getStatusColor(transfer.estado)} label={transfer.estado} />
          </Grid>
          {transfer.tipo === 'STEC' && transfer.ordenMantenimiento && (
            <Grid size={{ xs: 6, sm: 3 }}>
              <Typography variant="caption" color="text.secondary" display="block">Orden de Mantenimiento</Typography>
              <Typography variant="body1" color="primary" fontWeight="bold">{transfer.ordenMantenimiento}</Typography>
            </Grid>
          )}
        </Grid>
      </Paper>

      {/* --- LISTADO DE ÍTEMS EDITABLES --- */}
      {isItemsLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>
      ) : localItems.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
          <Typography color="text.secondary">No hay ítems en esta lista (Fueron eliminados o vino vacía).</Typography>
        </Paper>
      ) : isMobile ? (
        // VISTA MÓVIL (TARJETAS MODERNAS)
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
        // VISTA PC (TABLA DE ESCRITORIO)
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

      {/* --- PIE DE PÁGINA FIJO (STICKY FOOTER PARA LOS BOTONES) --- */}
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