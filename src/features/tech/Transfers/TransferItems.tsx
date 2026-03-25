import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Box, Typography, Paper, IconButton, Chip, Grid, Divider, Button, 
  useMediaQuery, Stack, Card, CardContent, CardActions, TextField, 
  Switch, FormControlLabel, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import { toast } from 'sonner';

import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { 
  fetchTransferItems, selectTransferItems, selectTransferHeader, selectItemsLoading, 
  saveTransfer, authorizeSapTransfer, selectIsSubmitting, type TransferItem, clearItems
} from './transferItemsSlice';

export const TransferItems = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const transferHeader = useAppSelector(selectTransferHeader);
  const reduxItems = useAppSelector(selectTransferItems);
  const isItemsLoading = useAppSelector(selectItemsLoading);
  const isSubmitting = useAppSelector(selectIsSubmitting);

  const [localItems, setLocalItems] = useState<TransferItem[]>([]);
  const [comentarios, setComentarios] = useState('');
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  useEffect(() => {
    if (id) dispatch(fetchTransferItems(id));
    return () => { dispatch(clearItems()); };
  }, [dispatch, id]);

  useEffect(() => {
    setLocalItems(reduxItems);
  }, [reduxItems]);

  // --- NUEVA LÓGICA DE TECLADO NUMÉRICO ---
  const handleQuantityChange = (itemId: string, newQuantity: string) => {
    // Si el usuario borra todo, lo dejamos como string vacío para que no estorbe
    if (newQuantity === '') {
      setLocalItems(prev => prev.map(item => item.id === itemId ? { ...item, cantidadRecibida: '' } : item));
      return;
    }

    // Filtramos para asegurar que solo escriba números (sin letras, "e", ni puntos)
    const cleanValue = newQuantity.replace(/[^0-9]/g, '');
    
    if (cleanValue !== '') {
      const val = parseInt(cleanValue, 10);
      setLocalItems(prev => prev.map(item => item.id === itemId ? { ...item, cantidadRecibida: val } : item));
    }
  };

  // Pequeña validación al perder el foco (Blur): Si dejó el campo vacío, le ponemos 0.
  const handleQuantityBlur = (itemId: string) => {
    setLocalItems(prev => prev.map(item => item.id === itemId && item.cantidadRecibida === '' ? { ...item, cantidadRecibida: 0 } : item));
  };

  const handleToggleAccept = (itemId: string) => {
    setLocalItems(prev => prev.map(item => item.id === itemId ? { ...item, isAccepted: !item.isAccepted } : item));
  };

  const handleDeleteItem = (itemId: string) => {
    setLocalItems(prev => prev.filter(item => item.id !== itemId));
    toast.info('Ítem removido de la lista');
  };

// --- BOTÓN 1: GUARDAR O ACTUALIZAR (SQL LOCAL) ---
  const handleSaveTransfer = async () => {
    if (!transferHeader) return;
    if (localItems.length === 0) return toast.error('No puedes guardar sin ítems.');

    try {
      // Guardamos y atrapamos el ID que nos devuelve el Slice
      const savedId = await dispatch(saveTransfer({ header: transferHeader, items: localItems, estadoForce: 'P' })).unwrap();
      
      toast.success(isNew ? '¡Transferencia guardada en SQL con éxito!' : '¡Transferencia actualizada!');
      
      if (isNew) {
        // EL TRUCO DE REACT: "Refrescamos" la pantalla cambiando la URL por el nuevo ID sin que parpadee
        navigate(`/tech/transfers/${savedId}/items`, { replace: true });
      } else {
        // Si ya existía y solo estaba actualizando, lo devolvemos a la lista (o puedes quitar el navigate si quieres que se quede ahí)
        navigate('/tech/transfers');
      }
    } catch (error) {
      toast.error(`${error}`);
    }
  };

  // --- BOTÓN 2 (PASO B): EL BAILE DE 3 PASOS ---
  const executeAuthorizeTransfer = async () => {
    if (!transferHeader) return;
    setConfirmModalOpen(false); 
    
    try {
      // 1. Guardamos localmente en SQL como Pendiente (por si falla SAP)
      await dispatch(saveTransfer({ header: transferHeader, items: localItems, estadoForce: 'P' })).unwrap();
      
      // 2. Enviamos la orden de autorización a SAP
      await dispatch(authorizeSapTransfer({ header: transferHeader, items: localItems, comentarios })).unwrap();
      
      // 3. SAP respondió OK. ¡Ahora sí cambiamos SQL a Aprobado ('A')!
      await dispatch(saveTransfer({ header: transferHeader, items: localItems, estadoForce: 'A' })).unwrap();
      
      toast.success('¡Transferencia Autorizada y enviada a SAP con éxito!');
      navigate('/tech/transfers');
    } catch (error) {
      // Si falla SAP, cae aquí y NUNCA ejecuta el paso 3. Nuestra SQL queda a salvo.
      toast.error(`${error}`);
    }
  };
const handleOpenAuthorizeConfirm = () => {
    if (!transferHeader) return;
    if (localItems.length === 0) return toast.error('No puedes autorizar sin ítems.');
    
    const unverifiedItems = localItems.filter(item => !item.isAccepted);
    if (unverifiedItems.length > 0) {
      toast.error('Debes verificar (encender el switch) todos los ítems de la lista antes de Autorizar.');
      return;
    }

    setConfirmModalOpen(true);
  };


  // TRADUCCIÓN VISUAL DE ESTADOS ("P" -> "Pendiente")
  const getStatusDisplay = (estado: string) => {
    const e = (estado || '').toUpperCase();
    if (e === 'P' || e === 'PENDIENTE') return { label: 'PENDIENTE', color: 'warning' as const };
    if (e === 'A' || e === 'APROBADO' || e === 'APROBADA') return { label: 'APROBADA', color: 'success' as const };
    if (e === 'PROCESADA') return { label: 'PROCESADA', color: 'info' as const };
    return { label: e || 'N/A', color: 'default' as const };
  };

  if (isItemsLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 10 }}><CircularProgress /></Box>;
  }

  if (!transferHeader) {
    return (
      <Box sx={{ textAlign: 'center', mt: 5 }}>
        <Typography variant="h6" color="text.secondary" gutterBottom>No se encontró la transferencia.</Typography>
        <Button variant="contained" startIcon={<ArrowBackIcon />} onClick={() => navigate('/tech/transfers')}>Volver al listado</Button>
      </Box>
    );
  }

  const isNew = transferHeader.id === 0;
  const estadoUI = getStatusDisplay(transferHeader.estado);

  return (
    // 28 (192px) en celulares (xs), y 12 (96px) en pantallas medianas o PC (md)
    <Box sx={{ pb: { xs: 28, md: 12 } }}>
      
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={() => navigate('/tech/transfers')} sx={{ mr: 1, backgroundColor: 'background.paper', boxShadow: 1 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" sx={{ fontWeight: 'bold' }}>Validación de Ítems</Typography>
      </Box>

      {/* --- CABECERA --- */}
      <Paper sx={{ p: { xs: 2, md: 3 }, mb: 3, borderRadius: 2, borderLeft: '6px solid', borderColor: 'primary.main' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" color="text.secondary" display="block">Nro. Transferencia</Typography>
            <Typography variant="body1" fontWeight="bold">{transferHeader.nroDocumento || transferHeader.nroInterno || 'Borrador'}</Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" color="text.secondary" display="block">Fecha</Typography>
            <Typography variant="body1">{transferHeader.fecha ? transferHeader.fecha.split('T')[0] : 'S/F'}</Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>Estado</Typography>
            <Chip size="small" color={estadoUI.color} label={estadoUI.label} />
          </Grid>
          {transferHeader.nroServicio && (
            <Grid size={{ xs: 6, sm: 3 }}>
              <Typography variant="caption" color="text.secondary" display="block">Orden de Mantenimiento</Typography>
              <Typography variant="body1" color="primary" fontWeight="bold">{transferHeader.nroServicio}</Typography>
            </Grid>
          )}
        </Grid>
      </Paper>

      {/* --- LISTADO DE ÍTEMS --- */}
      {localItems.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
          <Typography color="text.secondary">No hay ítems en esta lista.</Typography>
        </Paper>
      ) : isMobile ? (
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
                    {/* CAMPO DE TEXTO MÓVIL OPTIMIZADO */}
                    <TextField 
                      label="Recibida" type="text" size="small" fullWidth
                      value={item.cantidadRecibida} 
                      onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                      onBlur={() => handleQuantityBlur(item.id)}
                      inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }} // Abre el teclado numérico en móvil
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
                  <TableCell align="center"><Chip label={item.cantidadPedida} size="small" /></TableCell>
                  <TableCell align="center">
                    {/* CAMPO DE TEXTO PC OPTIMIZADO */}
                    <TextField 
                      type="text" size="small" fullWidth
                      value={item.cantidadRecibida} 
                      onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                      onBlur={() => handleQuantityBlur(item.id)}
                      inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
                      sx={{ input: { textAlign: 'center' } }}
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

      {/* --- CAJA DE COMENTARIOS --- */}
      <Paper sx={{ p: 2, mt: 3, mb: 2, borderRadius: 2 }}>
        <TextField
          label="Comentarios (Opcional)"
          multiline rows={2} fullWidth
          placeholder="Escribe alguna observación antes de autorizar la transferencia..."
          value={comentarios} onChange={(e) => setComentarios(e.target.value)}
        />
      </Paper>

      {/* --- PIE DE PÁGINA FIJO --- */}
      <Paper elevation={4} sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, p: 2, zIndex: 1000, borderTop: '1px solid #e0e0e0' }}>
        <Grid container spacing={2} justifyContent="center" sx={{ maxWidth: '900px', margin: '0 auto' }}>
          
          <Grid size={{ xs: 12, sm: 4 }}>
            <Button 
              variant="outlined" color="inherit" size="large" fullWidth
              startIcon={<CancelIcon />} onClick={() => navigate('/tech/transfers')} disabled={isSubmitting}
            >
              Cancelar
            </Button>
          </Grid>
          
          <Grid size={{ xs: 12, sm: 4 }}>
            <Button 
              variant="contained" color="primary" size="large" fullWidth
              startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />} 
              onClick={handleSaveTransfer} disabled={isSubmitting || localItems.length === 0}
            >
              {isNew ? 'Guardar' : 'Actualizar'}
            </Button>
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }}>
            <Button 
              variant="contained" color="success" size="large" fullWidth
              startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : <CheckCircleIcon />} 
              onClick={handleOpenAuthorizeConfirm} 
              // NUEVA REGLA: Deshabilitado si está cargando, si no hay ítems, o si ES NUEVO (ID = 0)
              disabled={isSubmitting || localItems.length === 0 || isNew}
            >
              {isNew ? 'Guarda primero para Autorizar' : 'Autorizar (SAP)'}
            </Button>
          </Grid>

        </Grid>
      </Paper>

      {/* --- MODAL DE CONFIRMACIÓN --- */}
      <Dialog open={confirmModalOpen} onClose={() => setConfirmModalOpen(false)} aria-labelledby="confirm-dialog-title">
        <DialogTitle id="confirm-dialog-title" sx={{ fontWeight: 'bold', color: 'success.main' }}>
          Confirmar Autorización
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            ¿Estás seguro de que deseas autorizar esta transferencia y enviarla a SAP? 
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Esta acción sincronizará los datos verificados y no podrá deshacerse.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setConfirmModalOpen(false)} color="inherit" disabled={isSubmitting}>
            Revisar de nuevo
          </Button>
          <Button onClick={executeAuthorizeTransfer} variant="contained" color="success" autoFocus disabled={isSubmitting}>
            Sí, Autorizar
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
};