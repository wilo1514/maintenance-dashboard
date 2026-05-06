import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { 
  Box, Typography, Paper, IconButton, Grid, Button, MenuItem,
  useMediaQuery, Stack, Card, CardContent, TextField, 
  CircularProgress, Autocomplete, Dialog, DialogTitle, DialogContent, DialogActions,
  TableContainer, Table, TableHead, TableRow, TableCell, TableBody, Chip, Alert
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SendIcon from '@mui/icons-material/Send';
import SaveIcon from '@mui/icons-material/Save';
import AssignmentIcon from '@mui/icons-material/Assignment';
import ContentPasteGoIcon from '@mui/icons-material/ContentPasteGo';
import { toast } from 'sonner';

import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { selectCurrentUser } from '../../auth/authSlice';
import api from '../../../services/api'; 
import { TECH_ENDPOINTS } from '../../../services/endpoints/tech';
import { 
  fetchTechBodegas, fetchTechUbicaciones, searchSapItems, saveTransfer, authorizeSapTransfer,
  fetchTransferItems, selectIsSubmitting, selectTechBodegas, selectTechUbicaciones, selectSapItems, selectSearchingItems,
  type TransferItem, type SapItemResponse
} from './transferItemsSlice';

interface SolicitudDetalle {
  item: string;
  descripcion: string;
  cantidadSolicitada: number;
  cantidadEntregada: number;
}

interface SolicitudTransferencia {
  id: number;
  fecha: string;
  bodegaHasta: string;
  ubicacionHasta: string;
  nroServicio?: string;
  estado?: string;
  detalles?: SolicitudDetalle[];
}

const getLocalIsoTime = () => {
  const tzoffset = (new Date()).getTimezoneOffset() * 60000;
  return new Date(Date.now() - tzoffset).toISOString().slice(0, -1);
};

const ubicacionCollator = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });

export const TransferCreate = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [searchParams] = useSearchParams();

  const { id } = useParams();
  const user = useAppSelector(selectCurrentUser);
  const isFT1 = user?.ubicacion === '05-FT1';
  const isSubmitting = useAppSelector(selectIsSubmitting);

  const bodegasOptions = useAppSelector(selectTechBodegas);
  const ubicacionesOptions = useAppSelector(selectTechUbicaciones);
  const itemsOptions = useAppSelector(selectSapItems);
  const isSearchingItems = useAppSelector(selectSearchingItems);
  const ubicacionesDestinoOptions = [...ubicacionesOptions]
    .filter((u) => !isFT1 || u.binCode !== '05-FT1')
    .sort((a, b) => ubicacionCollator.compare(a.binCode, b.binCode));

  const [savedId, setSavedId] = useState<number>(0); 
  const [bodegaHasta, setBodegaHasta] = useState('');
  const [ubicacionHasta, setUbicacionHasta] = useState('');
  
  const [items, setItems] = useState<TransferItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<SapItemResponse | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<SolicitudTransferencia[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  
  const [linkedRequestId, setLinkedRequestId] = useState<number | null>(null);
  const [linkedNroServicio, setLinkedNroServicio] = useState<string | null>(null);

  useEffect(() => {
    dispatch(fetchTechBodegas());
  }, [dispatch]);

  useEffect(() => {
    if (id && user?.idbranch && user?.ubicacion) {
      dispatch(fetchTransferItems({ 
        transferId: id, 
        bodega: user.idbranch, 
        ubicacion: user.ubicacion 
      })).unwrap()
        .then((data) => {
          const safeData = data as typeof data & { nroSolicitud?: number | null };

          setSavedId(safeData.id);
          setBodegaHasta(safeData.bodegaHasta);
          setUbicacionHasta(safeData.ubicacionHasta);
          setLinkedNroServicio(safeData.nroServicio || null);
          setLinkedRequestId(safeData.nroSolicitud || null); 
          
          dispatch(fetchTechUbicaciones(safeData.bodegaHasta));

          const loadedItems: TransferItem[] = safeData.details.map(d => ({
            id: d.id ? d.id.toString() : `loaded-${Date.now()}-${Math.random()}`,
            originalId: d.id,
            itemCode: d.item,
            descripcion: d.descripcion,
            cantidadPedida: d.cantidad,
            cantidadRecibida: d.cantidadRecibida,
            isAccepted: true
          }));
          setItems(loadedItems);
        })
        .catch(() => toast.error('Error al cargar el borrador de la transferencia.'));
    }
  }, [id, dispatch, user]);

  useEffect(() => {
    const solicitudIdParam = searchParams.get('solicitudId');
    if (solicitudIdParam && isFT1) {
      handleLoadRequestDetails(Number(solicitudIdParam));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, isFT1]);

  const handleBodegaChange = (whsCode: string) => {
    setBodegaHasta(whsCode);
    setUbicacionHasta('');
    if (whsCode) {
      dispatch(fetchTechUbicaciones(whsCode));
    }
  };

  useEffect(() => {
    const delay = setTimeout(() => {
      if (!user?.idbranch || !user?.ubicacion) return;
      if (searchQuery === '' || searchQuery.length >= 3) {
        dispatch(searchSapItems({ query: searchQuery, whsCode: user.idbranch, binLocation: user.ubicacion }));
      }
    }, 600);
    return () => clearTimeout(delay);
  }, [searchQuery, dispatch, user]);

  const handleAddItem = () => {
    if (!selectedItem) return;
    const existe = items.find(i => i.itemCode === selectedItem.itemCode);
    if (existe) return toast.warning('Este ítem ya está en la lista.');

    const newItem: TransferItem = {
      id: `temp-${Date.now()}`,
      itemCode: selectedItem.itemCode,
      descripcion: selectedItem.itemName,
      cantidadPedida: 1, 
      cantidadRecibida: 1, 
      isAccepted: true 
    };

    setItems([...items, newItem]);
    setSelectedItem(null); 
    setSearchQuery(''); 
  };

  const handleQuantityChange = (itemId: string, newQuantity: string) => {
    const cleanValue = newQuantity.replace(/[^0-9]/g, '');
    const val = cleanValue === '' ? 0 : parseInt(cleanValue, 10);
    setItems(prev => prev.map(item => item.id === itemId ? { ...item, cantidadPedida: val, cantidadRecibida: val } : item));
  };

  const handleQuantityBlur = (itemId: string) => {
    setItems(prev => prev.map(item => item.id === itemId && item.cantidadPedida === 0 ? { ...item, cantidadPedida: 1, cantidadRecibida: 1 } : item));
  };

  const handleDeleteItem = (itemId: string) => {
    setItems(prev => prev.filter(item => item.id !== itemId));
  };

  const handleOpenRequestsModal = async () => {
    setRequestModalOpen(true);
    setIsLoadingRequests(true);
    try {
      const res = await api.get(`${TECH_ENDPOINTS.GET_SOLICITUDES_TRANSFERENCIA}?Pagina=1&RecordsPorPagina=50&Bodega=${user?.idbranch}&Ubicacion=${user?.ubicacion}&Estado=P`);
      const data = Array.isArray(res.data) ? res.data : (res.data.items || res.data.registros || res.data);
      setPendingRequests(data as SolicitudTransferencia[]);
    } catch (error) {
      toast.error('Error al cargar las solicitudes pendientes.');
      console.error(error);
    } finally {
      setIsLoadingRequests(false);
    }
  };

  const handleLoadRequestDetails = async (reqId: number) => {
    try {
      toast.info(`Cargando solicitud #${reqId}...`);
      const res = await api.get(TECH_ENDPOINTS.GET_SOLICITUD_TRANSFERENCIA_BY_ID(reqId));
      
      // Adaptarse a posibles envoltorios de la API (.registro, .data, etc)
      const data = res.data?.registro || res.data?.data || res.data;

      const estado = data.estado || data.Estado;
      if (estado && estado !== 'P') {
        toast.warning(`La solicitud #${reqId} ya ha sido procesada o cancelada (Estado: ${estado}).`);
        setRequestModalOpen(false);
        return;
      }

      const solId = data.id || data.Id || reqId;
      const nServicio = data.nroServicio || data.NroServicio || null;
      const bHasta = data.bodegaHasta || data.BodegaHasta || '';
      const uHasta = data.ubicacionHasta || data.UbicacionHasta || '';

      setLinkedRequestId(solId);
      setLinkedNroServicio(nServicio);
      setBodegaHasta(bHasta);
      if (bHasta) {
        dispatch(fetchTechUbicaciones(bHasta));
      }
      setUbicacionHasta(uHasta);

      // Buscar detalles con diferentes posibles nombres (Detalles, details, etc)
      const detallesList = data.detalles || data.Detalles || data.details || data.Details;

      if (detallesList && Array.isArray(detallesList)) {
        if (detallesList.length === 0) {
          toast.warning("La solicitud se cargó, pero no contiene ítems.");
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mappedItems: TransferItem[] = detallesList.map((d: any, index: number) => {
            // Soportar CamelCase y PascalCase
            const qty = d.cantidadSolicitada ?? d.CantidadSolicitada ?? d.cantidad ?? d.Cantidad ?? 1;
            return {
              id: `req-${solId}-${index}`,
              itemCode: d.item || d.Item || d.itemCode || d.ItemCode || '',
              descripcion: d.descripcion || d.Descripcion || d.itemName || d.ItemName || '',
              cantidadPedida: qty,
              cantidadRecibida: qty,
              isAccepted: true
            };
          });
          setItems(mappedItems);
          toast.success(`Solicitud #${solId} cargada. Verifica los datos.`);
        }
      } else {
        toast.error("No se encontraron detalles en el formato esperado.");
      }

      setRequestModalOpen(false);
    } catch (error) {
      toast.error('Error al cargar los detalles de la solicitud.');
      console.error(error);
    }
  };

  const buildHeader = () => {
    return {
      id: savedId, 
      nroInterno: null,
      nroDocumento: null,
      bodegaDesde: user?.idbranch || '',
      ubicacionDesde: user?.ubicacion || '',
      bodegaHasta,
      ubicacionHasta,
      fecha: getLocalIsoTime(), 
      estado: 'P',
      tipo: 'TRF',
      nroServicio: linkedNroServicio, 
      nroTransferencia: null,
      nroSolicitud: linkedRequestId,  
      details: []
    };
  };

  const handleSaveDraft = async () => {
    if (!bodegaHasta || !ubicacionHasta) return toast.error('Selecciona Bodega y Ubicación de destino.');
    if (items.length === 0) return toast.error('Agrega al menos un ítem.');

    try {
      const header = buildHeader();
      const resultId = await dispatch(saveTransfer({ header, items, estadoForce: 'P' })).unwrap();
      if (savedId === 0 && typeof resultId === 'number') setSavedId(resultId);
      toast.success(savedId === 0 ? 'Borrador creado en SQL.' : 'Borrador actualizado.');
    } catch (error) {
      toast.error(`${error}`);
    }
  };

  const executeSendToSap = async () => {
    setConfirmModalOpen(false);
    try {
      const header = buildHeader();
      const resultId = await dispatch(saveTransfer({ header, items, estadoForce: 'P' })).unwrap();
      const activeId = savedId === 0 && typeof resultId === 'number' ? resultId : savedId;
      setSavedId(activeId); 
      
      const headerOficial = { ...header, id: activeId };

      await dispatch(authorizeSapTransfer({ header: headerOficial, items, comentarios: '', estadoForce: 'P' })).unwrap();
      
      if (linkedRequestId) {
        try {
          await api.patch(TECH_ENDPOINTS.PATCH_SOLICITUD_TRANSFERENCIA_ESTADO(linkedRequestId), { estado: 'A' });
          console.log(`Solicitud de transferencia #${linkedRequestId} marcada como Aprobada (A)`);
        } catch (patchErr) {
          console.error("Error al actualizar el estado de la solicitud origen", patchErr);
        }
      }

      toast.success('¡Transferencia enviada a SAP correctamente!');
      navigate('/tech/transfers');
    } catch (error) {
      toast.error(`Error: ${error}`);
    }
  };

  return (
    <Box sx={{ pb: { xs: 28, md: 12 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton onClick={() => navigate('/tech/transfers')} sx={{ mr: 1, bgcolor: 'background.paper', boxShadow: 1 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
            {savedId === 0 ? 'Nueva Transferencia' : `Borrador #${savedId}`}
          </Typography>
        </Box>

        {isFT1 && savedId === 0 && !linkedRequestId && (
          <Button 
            variant="outlined" 
            color="secondary" 
            startIcon={<AssignmentIcon />} 
            onClick={handleOpenRequestsModal}
            sx={{ display: { xs: 'none', sm: 'flex' } }}
          >
            Cargar Solicitud
          </Button>
        )}
      </Box>

      {isFT1 && savedId === 0 && !linkedRequestId && isMobile && (
        <Button variant="outlined" color="secondary" startIcon={<AssignmentIcon />} onClick={handleOpenRequestsModal} fullWidth sx={{ mb: 2 }}>
          Cargar Solicitud Pendiente
        </Button>
      )}

      {linkedRequestId && (
        <Alert 
          severity="info" 
          icon={<ContentPasteGoIcon />} 
          sx={{ mb: 3, fontWeight: 'bold', alignItems: 'center' }}
          action={
            <Button 
              color="inherit" 
              size="small" 
              onClick={() => { 
                setLinkedRequestId(null); 
                setLinkedNroServicio(null); 
                setItems([]); 
                setBodegaHasta(''); 
                setUbicacionHasta(''); 
              }}
            >
              Desvincular
            </Button>
          }
        >
          Transferencia enlazada a Solicitud #{linkedRequestId} {linkedNroServicio ? `(OS #${linkedNroServicio})` : ''}
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 3, borderRadius: 2, borderLeft: '6px solid', borderColor: 'info.main' }}>
        <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2, color: 'text.secondary' }}>1. Cabecera y Destino</Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField 
              select fullWidth size="small" label="Bodega Destino"
              value={bodegaHasta} onChange={(e) => handleBodegaChange(e.target.value)}
              disabled={!!linkedRequestId} 
            >
              {bodegasOptions.map((b) => (<MenuItem key={b.whsCode} value={b.whsCode}>{b.whsName}</MenuItem>))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField 
              select fullWidth size="small" label="Ubicación Destino"
              value={ubicacionHasta} onChange={(e) => setUbicacionHasta(e.target.value)}
              disabled={!bodegaHasta || ubicacionesDestinoOptions.length === 0 || !!linkedRequestId}
            >
              {ubicacionesDestinoOptions.map((u) => (<MenuItem key={u.absEntry} value={u.binCode}>{u.binCode}</MenuItem>))}
            </TextField>
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2, color: 'text.secondary' }}>2. Agregar Ítems</Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, sm: 9 }}>
            <Autocomplete
              options={itemsOptions}
              getOptionLabel={(option) => `${option.itemCode} - ${option.itemName} (Disp: ${option.onHandQty})`}
              isOptionEqualToValue={(option, value) => option.itemCode === value?.itemCode}
              loading={isSearchingItems}
              value={selectedItem}
              onChange={(_, newValue) => setSelectedItem(newValue)}
              onInputChange={(_, newInputValue) => setSearchQuery(newInputValue)}
              renderInput={(params) => (
                <TextField 
                  {...params} label="Buscar en inventario (Código o Nombre)" size="small"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <React.Fragment>
                        {isSearchingItems ? <CircularProgress color="inherit" size={20} /> : null}
                        {params.InputProps.endAdornment}
                      </React.Fragment>
                    ),
                  }}
                />
              )}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <Button variant="contained" fullWidth onClick={handleAddItem} disabled={!selectedItem}>
              Agregar a Lista
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {items.length === 0 ? (
        <Typography align="center" color="text.secondary" sx={{ py: 4 }}>No has agregado ningún ítem.</Typography>
      ) : isMobile ? (
        <Stack spacing={2}>
          {items.map((item) => (
            <Card key={item.id} elevation={2} sx={{ borderRadius: 2 }}>
              <CardContent sx={{ pb: 1 }}>
                <Typography variant="subtitle2" color="primary" fontWeight="bold">{item.itemCode}</Typography>
                <Typography variant="body2" sx={{ mb: 2 }}>{item.descripcion}</Typography>
                <Grid container spacing={2} alignItems="center">
                  <Grid size={{ xs: 8 }}>
                    <TextField 
                      label="Cantidad a Enviar" type="text" size="small" fullWidth
                      value={item.cantidadPedida === 0 ? '' : item.cantidadPedida} 
                      onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                      onBlur={() => handleQuantityBlur(item.id)}
                      inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }} 
                      sx={{ input: { textAlign: 'center', fontWeight: 'bold' } }}
                    />
                  </Grid>
                  <Grid size={{ xs: 4 }} display="flex" justifyContent="flex-end">
                    <IconButton color="error" onClick={() => handleDeleteItem(item.id)}>
                      <DeleteOutlineIcon />
                    </IconButton>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          ))}
        </Stack>
      ) : (
        <TableContainer component={Paper} elevation={2} sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead sx={{ backgroundColor: 'action.hover' }}>
              <TableRow>
                <TableCell width="20%">Código</TableCell>
                <TableCell width="50%">Descripción</TableCell>
                <TableCell width="20%" align="center">Cant. a Enviar</TableCell>
                <TableCell width="10%" align="center">Quitar</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell sx={{ fontWeight: 'bold', color: 'primary.main' }}>{item.itemCode}</TableCell>
                  <TableCell>{item.descripcion}</TableCell>
                  <TableCell align="center">
                    <TextField 
                      type="text" size="small"
                      value={item.cantidadPedida === 0 ? '' : item.cantidadPedida} 
                      onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                      onBlur={() => handleQuantityBlur(item.id)}
                      inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', style: { textAlign: 'center', fontWeight: 'bold' } }} 
                      sx={{ width: '100px' }}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <IconButton color="error" onClick={() => handleDeleteItem(item.id)}>
                      <DeleteOutlineIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Paper elevation={4} sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, p: 2, zIndex: 1000, borderTop: '1px solid #e0e0e0' }}>
        <Grid container spacing={2} justifyContent="center" sx={{ maxWidth: '900px', margin: '0 auto' }}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Button 
              variant="outlined" color="primary" size="large" fullWidth
              startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />} 
              onClick={handleSaveDraft} disabled={isSubmitting || items.length === 0 || !bodegaHasta || !ubicacionHasta}
            >
              Guardar Borrador
            </Button>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Button 
              variant="contained" color="success" size="large" fullWidth
              startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : <SendIcon />} 
              onClick={() => {
                if (!bodegaHasta || !ubicacionHasta) return toast.error('Falta el destino.');
                if (items.length === 0) return toast.error('Faltan ítems.');
                setConfirmModalOpen(true);
              }} 
              disabled={isSubmitting || items.length === 0}
            >
              Oficializar (Enviar a SAP)
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <Dialog open={confirmModalOpen} onClose={() => setConfirmModalOpen(false)}>
        <DialogTitle sx={{ fontWeight: 'bold', color: 'success.main' }}>Confirmar Envío a SAP</DialogTitle>
        <DialogContent>
          <Typography>¿Estás seguro de enviar esta transferencia? El sistema generará el Documento oficial en SAP y ya no podrás editar ni agregar más ítems.</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setConfirmModalOpen(false)} color="inherit" disabled={isSubmitting}>Cancelar</Button>
          <Button onClick={executeSendToSap} variant="contained" color="success" disabled={isSubmitting}>Sí, Enviar a SAP</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={requestModalOpen} onClose={() => setRequestModalOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold', color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
          <AssignmentIcon /> Solicitudes de Traslado Pendientes
        </DialogTitle>
        <DialogContent dividers sx={{ minHeight: '300px', p: { xs: 0, sm: 2 } }}>
          {isLoadingRequests ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><CircularProgress /></Box>
          ) : pendingRequests.length === 0 ? (
            <Typography align="center" color="text.secondary" mt={2}>No tienes solicitudes pendientes en tu bandeja.</Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead sx={{ bgcolor: 'action.hover' }}>
                  <TableRow>
                    <TableCell><strong>ID</strong></TableCell>
                    <TableCell><strong>Fecha</strong></TableCell>
                    <TableCell><strong>Origen</strong></TableCell>
                    <TableCell><strong>Nro OS</strong></TableCell>
                    <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' } }}><strong>Acción</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pendingRequests.map((req) => (
                    <TableRow 
                      key={req.id} 
                      hover 
                      onClick={() => handleLoadRequestDetails(req.id)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell sx={{ fontWeight: 'bold' }}>#{req.id}</TableCell>
                      <TableCell>{req.fecha.split('T')[0]}</TableCell>
                      <TableCell>{req.ubicacionHasta}</TableCell>
                      <TableCell>
                        {req.nroServicio ? <Chip size="small" label={`OS ${req.nroServicio}`} color="info" variant="outlined" /> : '-'}
                      </TableCell>
                      <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                        <Button size="small" variant="contained">
                          Cargar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setRequestModalOpen(false)} color="inherit">Cerrar</Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
};
