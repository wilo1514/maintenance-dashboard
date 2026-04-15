import React, { useEffect, useState } from 'react';
import { 
  Box, Typography, Paper, Grid, TextField, Button, Table, TableBody, 
  TableCell, TableContainer, TableHead, TableRow, IconButton, Chip, 
  CircularProgress, Avatar
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SaveIcon from '@mui/icons-material/Save';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit'; // 🚨 FIX: Importación agregada

import { useParams, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { toast } from 'sonner';

import { 
  fetchOrdenCompraById, updateOrdenCompra, autorizarOrdenCompra, 
  selectCurrentOrdenCompra, selectOrdenesCompraLoading, selectOrdenesCompraSaving,
  type OrdenCompraDetalle 
} from './ordenesCompraSlice';

export const OrdenCompraEdit = () => {
  const { id } = useParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const ordenCompra = useAppSelector(selectCurrentOrdenCompra);
  const isLoading = useAppSelector(selectOrdenesCompraLoading);
  const isSaving = useAppSelector(selectOrdenesCompraSaving);

  const [detallesLocales, setDetallesLocales] = useState<OrdenCompraDetalle[]>([]);

  // 🚨 FIX: Llenamos los detalles locales solo cuando la promesa de Redux termina con éxito.
  // Así evitamos el cascading render y cumplimos con las reglas de React.
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
          // El error ya es manejado por el slice/redux
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

  const handleGuardarCambios = async () => {
    if (!ordenCompra) return;

    try {
      const payload = {
        nroInterno: ordenCompra.nroInterno || 0,
        nroDocumento: ordenCompra.nroDocumento || 0,
        proveedorId: ordenCompra.proveedorId,
        fecha: ordenCompra.fecha,
        fechaVencimiento: ordenCompra.fechaVencimiento,
        comentarios: ordenCompra.comentarios,
        series: ordenCompra.series,
        estado: ordenCompra.estado,
        ubicacionServicioTecnico: ordenCompra.ubicacionServicioTecnico,
        nroServicio: ordenCompra.nroServicio,
        detalles: detallesLocales
      };

      // 🚨 Mantenemos la tabla sincronizada con la nueva data tras guardar
      const ordenActualizada = await dispatch(updateOrdenCompra({ id: ordenCompra.id, data: payload })).unwrap();
      if (ordenActualizada && ordenActualizada.detalles) {
        setDetallesLocales([...ordenActualizada.detalles]);
      }
      
      toast.success("Orden de compra actualizada correctamente.");
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Error al guardar";
      toast.error(msg);
    }
  };

  const handleAutorizar = async () => {
    if (!ordenCompra) return;
    
    await handleGuardarCambios();

    try {
      await dispatch(autorizarOrdenCompra(ordenCompra.id)).unwrap();
      toast.success("Orden autorizada con éxito.");
      navigate('/tech/ordenes-compra'); 
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

  const isEditable = ordenCompra.estado === 'P';

  return (
    <Box sx={{ pb: { xs: 10, md: 4 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={() => navigate('/tech/ordenes-compra')}><ArrowBackIcon /></IconButton>
          <Avatar sx={{ bgcolor: isEditable ? 'warning.main' : 'success.main' }}>
            {isEditable ? <EditIcon /> : <CheckCircleIcon />}
          </Avatar>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>Revisión de OC #{ordenCompra.id}</Typography>
            <Chip size="small" label={isEditable ? 'PENDIENTE AUTORIZACIÓN' : 'AUTORIZADA'} color={isEditable ? 'warning' : 'success'} />
          </Box>
        </Box>
        
        {isEditable && (
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button variant="outlined" startIcon={<SaveIcon />} onClick={handleGuardarCambios} disabled={isSaving}>
              Guardar Cambios
            </Button>
            <Button variant="contained" color="success" startIcon={<CheckCircleIcon />} onClick={handleAutorizar} disabled={isSaving}>
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
              {detallesLocales.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                    No hay detalles en esta orden de compra.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};