import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Box, Typography, Paper, IconButton, Chip, Grid, Divider, Button, 
  useMediaQuery, Stack, Card, CardContent, CardActions, TextField, 
  Switch, FormControlLabel, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, MenuItem
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import { toast } from 'sonner';

import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { selectCurrentUser } from '../../auth/authSlice'; 
import { 
  fetchTransferItems, selectTransferItems, selectTransferHeader, selectItemsLoading, 
  saveTransfer, authorizeSapTransfer, selectIsSubmitting, type TransferItem, clearItems
} from './transferItemsSlice';
import api from '../../../services/api';
import { TECH_ENDPOINTS } from '../../../services/endpoints/tech';
import { type ApiTransferResponse } from '../transfersSlice';

export const TransferItems = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const user = useAppSelector(selectCurrentUser);
  const isFT1 = user?.ubicacion === '05-FT1';

  const isValidateRoute = id === 'validate';
  const activeId = isValidateRoute ? null : id;

  const transferHeader = useAppSelector(selectTransferHeader);
  const reduxItems = useAppSelector(selectTransferItems);
  const isItemsLoading = useAppSelector(selectItemsLoading);
  const isSubmitting = useAppSelector(selectIsSubmitting);

  const [localItems, setLocalItems] = useState<TransferItem[]>([]);
  const [comentarios, setComentarios] = useState('');
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  const [pendingTransfers, setPendingTransfers] = useState<ApiTransferResponse[]>([]);
  const [selectedComboId, setSelectedComboId] = useState('');

  useEffect(() => {
    if (activeId && user?.idbranch && user?.ubicacion) {
      dispatch(fetchTransferItems({ 
        transferId: activeId, 
        bodega: user.idbranch, 
        ubicacion: user.ubicacion 
      }));
    }
    return () => { dispatch(clearItems()); };
  }, [dispatch, activeId, user]);

  useEffect(() => {
    if (isValidateRoute && !isFT1 && user?.idbranch && user?.ubicacion) {
      const fetchPending = async () => {
        try {
          const oneMonthAgo = new Date();
          oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
          const fechaDesde = oneMonthAgo.toISOString().split('T')[0];

          const query = `?pagina=1&recordsPorPagina=15&soloConNroInterno=true&bodega=${user.idbranch}&ubicacion=${user.ubicacion}&fechaDesde=${fechaDesde}`;
          const res = await api.get<ApiTransferResponse[]>(`${TECH_ENDPOINTS.GET_TRANSFERS}${query}`);
          
          const validables = res.data.filter(t => !t.nroTransferencia);
          setPendingTransfers(validables);
        } catch (error) {
          console.error("Error cargando combo", error);
        }
      };
      fetchPending();
    }
  }, [isValidateRoute, isFT1, user]);

  useEffect(() => {
    setLocalItems(reduxItems);
  }, [reduxItems]);

  const handleComboChange = (val: string) => {
    setSelectedComboId(val);
    if (val && user?.idbranch && user?.ubicacion) {
      dispatch(fetchTransferItems({ transferId: val, bodega: user.idbranch, ubicacion: user.ubicacion }));
    } else {
      dispatch(clearItems());
    }
  };

  const handleQuantityChange = (itemId: string, newQuantity: string) => {
    if (newQuantity === '') {
      setLocalItems(prev => prev.map(item => item.id === itemId ? { ...item, cantidadRecibida: '' } : item));
      return;
    }
    const cleanValue = newQuantity.replace(/[^0-9]/g, '');
    if (cleanValue !== '') {
      const val = parseInt(cleanValue, 10);
      setLocalItems(prev => prev.map(item => item.id === itemId ? { ...item, cantidadRecibida: val } : item));
    }
  };

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

  // 🚨 CORRECCIÓN: isValidationCreate ahora confía ciegamente en la ruta
  const isValidationCreate = isValidateRoute;
  const isNew = transferHeader ? (transferHeader.id === 0 || isValidationCreate) : false;

  const handleSaveTransfer = async () => {
    if (!transferHeader) return;
    if (localItems.length === 0) return toast.error('No puedes guardar sin ítems.');

    try {
      const savedId = await dispatch(saveTransfer({ header: transferHeader, items: localItems, estadoForce: 'P', isValidationCreate })).unwrap();
      toast.success(isNew ? '¡Borrador creado en SQL con éxito!' : '¡Transferencia actualizada!');
      
      if (isValidationCreate || isNew) {
        navigate(`/tech/transfers/${savedId}/items`, { replace: true });
      } else {
        navigate('/tech/transfers');
      }
    } catch (error) {
      toast.error(`${error}`);
    }
  };

  const executeAuthorizeTransfer = async () => {
    if (!transferHeader) return;
    setConfirmModalOpen(false); 
    try {
      let activeId = transferHeader.id;
      let headerToAuthorize = transferHeader;

      // 🚨 BLINDAJE: Si es una validación nueva y le dan a autorizar sin guardar antes,
      // la guardamos primero en SQL para conseguir un ID real y no enviarle 0 a SAP.
      if (isValidationCreate) {
        const newId = await dispatch(saveTransfer({ header: transferHeader, items: localItems, estadoForce: 'P', isValidationCreate: true })).unwrap();
        activeId = Number(newId);
        // Forzamos nroTransferencia al ID del padre para no perder el rastro en SAP
        headerToAuthorize = { ...transferHeader, id: activeId, nroTransferencia: transferHeader.id };
      }

      // 1. Enviamos a SAP con el ID correcto (isValidationCreate falso porque ya existe)
      await dispatch(authorizeSapTransfer({ header: headerToAuthorize, items: localItems, comentarios, estadoForce: 'A', isValidationCreate: false })).unwrap();
      
      // 2. Actualizamos en SQL a estado 'A'
      await dispatch(saveTransfer({ header: headerToAuthorize, items: localItems, estadoForce: 'A', isValidationCreate: false })).unwrap();
      
      toast.success('¡Transferencia Autorizada en SAP y registrada en SQL con éxito!');
      navigate('/tech/transfers');
    } catch (error) {
      toast.error(`${error}`);
    }
  };

  const handleOpenAuthorizeConfirm = () => {
    if (!transferHeader) return;
    if (localItems.length === 0) return toast.error('No puedes autorizar sin ítems.');
    
    const unverifiedItems = localItems.filter(item => !item.isAccepted);
    if (unverifiedItems.length > 0) return toast.error('Debes verificar todos los ítems antes de Autorizar.');

    setConfirmModalOpen(true);
  };

  const getStatusDisplay = (estado: string) => {
    const e = (estado || '').toUpperCase();
    if (e === 'P' || e === 'PENDIENTE') return { label: 'PENDIENTE', color: 'warning' as const };
    if (e === 'A' || e === 'APROBADO' || e === 'APROBADA') return { label: 'APROBADA', color: 'success' as const };
    if (e === 'PROCESADA') return { label: 'PROCESADA', color: 'info' as const };
    return { label: e || 'N/A', color: 'default' as const };
  };

  if (isItemsLoading && !isValidateRoute) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 10 }}><CircularProgress /></Box>;
  
  if (!transferHeader && !isValidateRoute) return (
    <Box sx={{ textAlign: 'center', mt: 5 }}>
      <Typography variant="h6" color="text.secondary" gutterBottom>No se encontró la transferencia.</Typography>
      <Button variant="contained" startIcon={<ArrowBackIcon />} onClick={() => navigate('/tech/transfers')}>Volver al listado</Button>
    </Box>
  );

  const estadoUI = transferHeader ? getStatusDisplay(transferHeader.estado) : { label: 'N/A', color: 'default' as const };

  return (
    <Box sx={{ pb: { xs: 28, md: 12 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={() => navigate('/tech/transfers')} sx={{ mr: 1, backgroundColor: 'background.paper', boxShadow: 1 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" sx={{ fontWeight: 'bold' }}>Validación de Ítems</Typography>
      </Box>

      {isValidateRoute && !isFT1 && (
        <Paper sx={{ p: 3, mb: 3, borderRadius: 2 }}>
          <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2, color: 'text.secondary' }}>Selecciona la transferencia a validar</Typography>
          <TextField 
            select fullWidth size="medium" label="Transferencias Pendientes"
            value={selectedComboId} onChange={(e) => handleComboChange(e.target.value)}
          >
            {pendingTransfers.length === 0 && <MenuItem value="" disabled>No hay transferencias pendientes del último mes</MenuItem>}
            {pendingTransfers.map((pt) => (
              <MenuItem key={pt.id} value={pt.id.toString()}>
                {`#${pt.nroDocumento || pt.nroInterno} - Creada el: ${pt.fecha.split('T')[0]}`}
              </MenuItem>
            ))}
          </TextField>
        </Paper>
      )}

      {isItemsLoading && isValidateRoute && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
      )}

      {transferHeader && !isItemsLoading && (
        <>
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
                        <TextField 
                          label="Recibida" type="text" size="small" fullWidth
                          value={item.cantidadRecibida} 
                          onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                          onBlur={() => handleQuantityBlur(item.id)}
                          inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }} 
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

          <Paper sx={{ p: 2, mt: 3, mb: 2, borderRadius: 2 }}>
            <TextField
              label="Comentarios (Opcional)" multiline rows={2} fullWidth
              placeholder="Escribe alguna observación antes de autorizar la transferencia..."
              value={comentarios} onChange={(e) => setComentarios(e.target.value)}
            />
          </Paper>

          <Paper elevation={4} sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, p: 2, zIndex: 1000, borderTop: '1px solid #e0e0e0' }}>
            <Grid container spacing={2} justifyContent="center" sx={{ maxWidth: '900px', margin: '0 auto' }}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Button variant="outlined" color="inherit" size="large" fullWidth startIcon={<CancelIcon />} onClick={() => navigate('/tech/transfers')} disabled={isSubmitting}>
                  Cancelar
                </Button>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Button variant="contained" color="primary" size="large" fullWidth startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />} onClick={handleSaveTransfer} disabled={isSubmitting || localItems.length === 0}>
                  {isNew ? 'Guardar Borrador' : 'Actualizar'}
                </Button>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Button 
                  variant="contained" color="success" size="large" fullWidth 
                  startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : <CheckCircleIcon />} 
                  onClick={handleOpenAuthorizeConfirm} 
                  disabled={isSubmitting || localItems.length === 0}
                >
                  Autorizar (SAP)
                </Button>
              </Grid>
            </Grid>
          </Paper>

          <Dialog open={confirmModalOpen} onClose={() => setConfirmModalOpen(false)}>
            <DialogTitle sx={{ fontWeight: 'bold', color: 'success.main' }}>Confirmar Autorización</DialogTitle>
            <DialogContent>
              <Typography variant="body1">¿Estás seguro de que deseas autorizar esta transferencia y enviarla a SAP?</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Esta acción sincronizará los datos verificados y no podrá deshacerse.</Typography>
            </DialogContent>
            <DialogActions sx={{ p: 2, pt: 0 }}>
              <Button onClick={() => setConfirmModalOpen(false)} color="inherit" disabled={isSubmitting}>Revisar de nuevo</Button>
              <Button onClick={executeAuthorizeTransfer} variant="contained" color="success" autoFocus disabled={isSubmitting}>Sí, Autorizar</Button>
            </DialogActions>
          </Dialog>
        </>
      )}
    </Box>
  );
};