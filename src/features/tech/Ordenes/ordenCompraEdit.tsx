import React, { useEffect, useState } from 'react';
import { 
  Box, Typography, Paper, Grid, TextField, Button, Table, TableBody, 
  TableCell, TableContainer, TableHead, TableRow, IconButton, Chip, 
  CircularProgress, Avatar, useTheme, useMediaQuery, Stack, Card, CardContent
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SaveIcon from '@mui/icons-material/Save';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';

import { useParams, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { toast } from 'sonner';

import { selectCurrentUser } from '../../auth/authSlice';

import { 
  fetchOrdenCompraById, updateOrdenCompra, autorizarOrdenCompra, 
  selectCurrentOrdenCompra, selectOrdenesCompraLoading, selectOrdenesCompraSaving,
  type OrdenCompraDetalle 
} from './ordenesCompraSlice';

export const OrdenCompraEdit = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const { id } = useParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const user = useAppSelector(selectCurrentUser);
  const isFT1 = user?.ubicacion === '05-FT1';

  const ordenCompra = useAppSelector(selectCurrentOrdenCompra);
  const isLoading = useAppSelector(selectOrdenesCompraLoading);
  const isSaving = useAppSelector(selectOrdenesCompraSaving);

  const [detallesLocales, setDetallesLocales] = useState<OrdenCompraDetalle[]>([]);

  useEffect(() => {
    if (id) {
      dispatch(fetchOrdenCompraById(Number(id)))
        .unwrap()
        .then((data) => {
          if (data && data.detalles) {
            setDetallesLocales([...data.detalles]);
          }
        })
        .catch(() => {
          // Manejado por Redux
        });
    }
  }, [id, dispatch]);

  const handleCantidadChange = (detalleId: number, nuevaCantidad: number) => {
    if (nuevaCantidad < 1) return;
    setDetallesLocales(prev => 
      prev.map(d => d.id === detalleId ? { ...d, cantidad: nuevaCantidad } : d)
    );
  };

  const handleEliminarDetalle = (detalleId: number) => {
    setDetallesLocales(prev => prev.filter(d => d.id !== detalleId));
  };

  // 🚨 FUNCIÓN BASE aisla la lógica de enviar los datos a la API
  const procesarGuardadoBase = async () => {
    const payload = {
      nroInterno: ordenCompra!.nroInterno || 0,
      nroDocumento: ordenCompra!.nroDocumento || 0,
      proveedorId: ordenCompra!.proveedorId,
      fecha: ordenCompra!.fecha,
      fechaVencimiento: ordenCompra!.fechaVencimiento,
      comentarios: ordenCompra!.comentarios,
      series: ordenCompra!.series,
      estado: ordenCompra!.estado,
      ubicacionServicioTecnico: ordenCompra!.ubicacionServicioTecnico,
      nroServicio: ordenCompra!.nroServicio,
      detalles: detallesLocales
    };

    return await dispatch(updateOrdenCompra({ id: ordenCompra!.id, data: payload })).unwrap();
  };

  // 🚨 GUARDAR Y SALIR
  const handleGuardarCambios = async () => {
    if (!ordenCompra) return;

    try {
      await procesarGuardadoBase();
      toast.success("Orden de compra actualizada correctamente.");
      navigate('/tech/ordenes-compra'); // <-- Redirección inmediata a la lista
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Error al guardar";
      toast.error(msg);
    }
  };

  // 🚨 AUTORIZAR Y SALIR
  const handleAutorizar = async () => {
    if (!ordenCompra) return;
    
    try {
      await procesarGuardadoBase(); // Primero guardamos los cambios de cantidad/ítems
      await dispatch(autorizarOrdenCompra(ordenCompra.id)).unwrap(); // Luego autorizamos
      toast.success("Orden autorizada con éxito.");
      navigate('/tech/ordenes-compra'); // <-- Redirección inmediata a la lista
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Error al autorizar";
      toast.error(msg);
    }
  };

  if (isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>;
  }

  if (!ordenCompra) {
    return <Typography color="error" textAlign="center">No se encontró la orden de compra.</Typography>;
  }

  const isEditable = isFT1 && ordenCompra.estado === 'P';
  const estadoLabel = ordenCompra.estado === 'P' ? 'PENDIENTE' : ordenCompra.estado === 'A' ? 'AUTORIZADA' : ordenCompra.estado === 'L' ? 'LIQUIDADA' : ordenCompra.estado;

  return (
    <Box sx={{ pb: { xs: 10, md: 4 } }}>
      <Box sx={{ 
        display: 'flex', 
        flexDirection: { xs: 'column', sm: 'row' }, 
        justifyContent: 'space-between', 
        alignItems: { xs: 'flex-start', sm: 'center' }, 
        mb: 3, gap: 2 
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={() => navigate('/tech/ordenes-compra')}><ArrowBackIcon /></IconButton>
          <Avatar sx={{ bgcolor: isEditable ? 'warning.main' : 'success.main' }}>
            {isEditable ? <EditIcon /> : <CheckCircleIcon />}
          </Avatar>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
              {isEditable ? `Revisión de OC #${ordenCompra.id}` : `Detalle de OC #${ordenCompra.id}`}
            </Typography>
            <Chip 
              size="small" 
              label={estadoLabel} 
              color={ordenCompra.estado === 'P' ? 'warning' : 'success'} 
              sx={{ fontWeight: 'bold' }}
            />
          </Box>
        </Box>
        
        {isEditable && (
          <Box sx={{ 
            display: 'flex', 
            flexDirection: { xs: 'column', sm: 'row' }, 
            gap: 2, 
            width: { xs: '100%', sm: 'auto' } 
          }}>
            <Button variant="outlined" fullWidth startIcon={<SaveIcon />} onClick={handleGuardarCambios} disabled={isSaving}>
              Guardar y Salir
            </Button>
            <Button variant="contained" color="success" fullWidth startIcon={<CheckCircleIcon />} onClick={handleAutorizar} disabled={isSaving}>
              Autorizar y Cerrar
            </Button>
          </Box>
        )}
      </Box>

      <Paper sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Typography variant="subtitle1" fontWeight="bold" color="primary" mb={2}>Información General</Typography>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, sm: 3 }}>
            <TextField label="Proveedor ID" fullWidth size="small" value={ordenCompra.proveedorId} disabled />
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <TextField label="Orden de Servicio Relacionada" fullWidth size="small" value={`OS #${ordenCompra.nroServicio}`} disabled />
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <TextField label="Fecha Emisión" fullWidth size="small" value={ordenCompra.fecha.split('T')[0]} disabled />
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <TextField label="Ubicación Destino" fullWidth size="small" value={ordenCompra.ubicacionServicioTecnico} disabled />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField label="Comentarios (Desde OS)" fullWidth multiline rows={2} value={ordenCompra.comentarios} disabled />
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 3, borderRadius: 2 }}>
        <Typography variant="subtitle1" fontWeight="bold" color="primary" mb={2}>Detalle de Repuestos a Comprar</Typography>
        
        {detallesLocales.length === 0 ? (
          <Typography align="center" color="text.secondary" py={3}>
            No hay detalles en esta orden de compra.
          </Typography>
        ) : isMobile ? (
          <Stack spacing={2}>
            {detallesLocales.map((detalle) => (
              <Card key={detalle.id} variant="outlined" sx={{ borderRadius: 2 }}>
                <CardContent sx={{ pb: '16px !important' }}>
                  <Typography variant="subtitle2" fontWeight="bold" color="primary">
                    {detalle.item}
                  </Typography>
                  <Typography variant="body2" mb={1}>{detalle.descripcion}</Typography>
                  <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                    Bodega: <Chip size="small" label={detalle.bodega} variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                  </Typography>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'action.hover', p: 1.5, borderRadius: 1 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block">P. Unitario</Typography>
                      <Typography variant="body2" fontWeight="medium">${Number(detalle.precio).toFixed(2)}</Typography>
                    </Box>
                    <Box sx={{ width: '80px' }}>
                      <Typography variant="caption" color="text.secondary" display="block" textAlign="center">Cant.</Typography>
                      <TextField 
                        type="number" size="small" fullWidth
                        value={detalle.cantidad} 
                        onChange={(e) => handleCantidadChange(detalle.id, Number(e.target.value))}
                        disabled={!isEditable}
                        inputProps={{ min: 1, style: { textAlign: 'center', padding: '6px' } }}
                      />
                    </Box>
                    <Box textAlign="right">
                      <Typography variant="caption" color="text.secondary" display="block">Total</Typography>
                      <Typography variant="body2" fontWeight="bold" color="primary">
                        ${(Number(detalle.precio) * detalle.cantidad).toFixed(2)}
                      </Typography>
                    </Box>
                  </Box>

                  {isEditable && (
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                      <IconButton color="error" size="small" onClick={() => handleEliminarDetalle(detalle.id)}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  )}
                </CardContent>
              </Card>
            ))}
          </Stack>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead sx={{ bgcolor: 'action.hover' }}>
                <TableRow>
                  <TableCell>Código Ítem</TableCell>
                  <TableCell>Descripción</TableCell>
                  <TableCell align="center">Bodega Destino</TableCell>
                  <TableCell align="center">Precio Base</TableCell>
                  <TableCell align="center" width="150px">Cantidad</TableCell>
                  <TableCell align="right">Total</TableCell>
                  {isEditable && <TableCell align="center">Acciones</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {detallesLocales.map((detalle) => (
                  <TableRow key={detalle.id}>
                    <TableCell>{detalle.item}</TableCell>
                    <TableCell>{detalle.descripcion}</TableCell>
                    <TableCell align="center"><Chip size="small" label={detalle.bodega} variant="outlined" /></TableCell>
                    <TableCell align="center">${Number(detalle.precio).toFixed(2)}</TableCell>
                    <TableCell align="center">
                      <TextField 
                        type="number" size="small" 
                        value={detalle.cantidad} 
                        onChange={(e) => handleCantidadChange(detalle.id, Number(e.target.value))}
                        disabled={!isEditable}
                        inputProps={{ min: 1, style: { textAlign: 'center' } }}
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      ${(Number(detalle.precio) * detalle.cantidad).toFixed(2)}
                    </TableCell>
                    {isEditable && (
                      <TableCell align="center">
                        <IconButton color="error" onClick={() => handleEliminarDetalle(detalle.id)}>
                          <DeleteOutlineIcon />
                        </IconButton>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
};