import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, TextField, MenuItem, Button, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Chip, Card,
  CardContent, Stack, CircularProgress, useMediaQuery, Autocomplete
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { toast } from 'sonner';

import FilterAltIcon from '@mui/icons-material/FilterAlt';
import EditIcon from '@mui/icons-material/Edit';
import ShoppingCartCheckoutIcon from '@mui/icons-material/ShoppingCartCheckout';

import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { useNavigate } from 'react-router-dom';
import api from '../../../services/api';
import { fetchOrdenesCompra, selectAllOrdenesCompra, selectOrdenesCompraLoading, type ProveedorSAP } from './ordenesCompraSlice';

const getOneMonthAgoDate = () => {
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  return date.toISOString().split('T')[0]; 
};

export const OrdenesCompraList = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const ordenes = useAppSelector(selectAllOrdenesCompra);
  const isLoading = useAppSelector(selectOrdenesCompraLoading);

  const [filtros, setFiltros] = useState({
    fechaDesde: getOneMonthAgoDate(),
    fechaHasta: '',
    estado: 'P',
    nroServicio: ''
  });

  // FIX: Quitamos setPaginacion para evitar el warning de variable sin uso
  const [paginacion] = useState({ pagina: 1, recordsPorPagina: 50 });
  
  const [proveedores, setProveedores] = useState<ProveedorSAP[]>([]);
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState<ProveedorSAP | null>(null);
  const [isSearchingProv, setIsSearchingProv] = useState(false);

  useEffect(() => {
    cargarOrdenes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paginacion.pagina, paginacion.recordsPorPagina]);

  const cargarOrdenes = () => {
    dispatch(fetchOrdenesCompra({
      pagina: paginacion.pagina,
      recordsPorPagina: paginacion.recordsPorPagina,
      fechaDesde: filtros.fechaDesde || undefined,
      fechaHasta: filtros.fechaHasta || undefined,
      estado: filtros.estado,
      nroServicio: filtros.nroServicio || undefined,
      proveedorId: proveedorSeleccionado ? proveedorSeleccionado.cardCode : undefined
    }));
  };

  const buscarProveedores = async (termino: string) => {
    if (termino.length < 3) return;
    setIsSearchingProv(true);
    try {
      const response = await api.get<ProveedorSAP[]>(`/sap/proveedores/pornombre?nombre=${termino}&top=20&skip=0`);
      setProveedores(response.data);
    } catch (error: unknown) {
      // FIX: Usamos el toast para que ya no marque error de "nunca leído"
      toast.error("Ocurrió un error al buscar los proveedores en SAP.");
      console.error("Error buscando proveedores:", error);
    } finally {
      setIsSearchingProv(false);
    }
  };

  const formatEstado = (estado: string) => {
    return estado === 'P' ? 'PENDIENTE' : estado === 'A' ? 'AUTORIZADA' : estado;
  };

  return (
    <Box sx={{ pb: { xs: 10, md: 4 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <ShoppingCartCheckoutIcon color="primary" fontSize="large" />
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 'bold' }}>Órdenes de Compra</Typography>
          <Typography variant="body2" color="text.secondary">Revisión y autorización para Servicios Técnicos</Typography>
        </Box>
      </Box>

      <Paper sx={{ p: { xs: 2, md: 3 }, mb: 3, borderRadius: 2 }}>
        <Grid container spacing={2} alignItems="center">
          {/* FIX: Cambio de `item xs={...}` a `size={{ xs: ... }}` para MUI moderno */}
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <TextField label="Fecha Desde" type="date" fullWidth size="small" InputLabelProps={{ shrink: true }} value={filtros.fechaDesde} onChange={(e) => setFiltros({ ...filtros, fechaDesde: e.target.value })} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <TextField label="Fecha Hasta" type="date" fullWidth size="small" InputLabelProps={{ shrink: true }} value={filtros.fechaHasta} onChange={(e) => setFiltros({ ...filtros, fechaHasta: e.target.value })} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Autocomplete
              size="small"
              options={proveedores}
              getOptionLabel={(option) => `${option.cardCode} - ${option.cardName}`}
              loading={isSearchingProv}
              onInputChange={(e, value) => buscarProveedores(value)}
              onChange={(e, value) => setProveedorSeleccionado(value)}
              renderInput={(params) => <TextField {...params} label="Buscar Proveedor" variant="outlined" InputProps={{ ...params.InputProps, endAdornment: (<>{isSearchingProv ? <CircularProgress color="inherit" size={20} /> : null}{params.InputProps.endAdornment}</>) }} />}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <TextField label="Nro. Servicio (OS)" fullWidth size="small" value={filtros.nroServicio} onChange={(e) => setFiltros({ ...filtros, nroServicio: e.target.value })} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 1 }}>
            <TextField select label="Estado" fullWidth size="small" value={filtros.estado} onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}>
              <MenuItem value="TODOS">Todos</MenuItem>
              <MenuItem value="P">Pendiente</MenuItem>
              <MenuItem value="A">Autorizada</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <Button variant="contained" color="primary" fullWidth startIcon={<FilterAltIcon />} onClick={cargarOrdenes} sx={{ height: '40px' }}>Filtrar</Button>
          </Grid>
        </Grid>
      </Paper>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>
      ) : ordenes.length === 0 ? (
        <Paper sx={{ p: 5, textAlign: 'center', borderRadius: 2 }}><Typography color="text.secondary">No se encontraron órdenes de compra.</Typography></Paper>
      ) : isMobile ? (
        <Stack spacing={2}>
          {ordenes.map((oc) => (
            <Card key={oc.id} elevation={2} sx={{ borderRadius: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="subtitle1" fontWeight="bold" color="primary">OC #{oc.id}</Typography>
                  <Chip size="small" label={formatEstado(oc.estado)} color={oc.estado === 'P' ? 'warning' : 'success'} />
                </Box>
                <Typography variant="body2"><strong>Proveedor:</strong> {oc.proveedorId}</Typography>
                <Typography variant="body2"><strong>Servicio OS:</strong> #{oc.nroServicio}</Typography>
                <Typography variant="body2"><strong>Fecha:</strong> {oc.fecha.split('T')[0]}</Typography>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                  <Button size="small" variant="contained" startIcon={<EditIcon />} onClick={() => navigate(`/tech/ordenes-compra/${oc.id}/edit`)}>
                    {oc.estado === 'P' ? 'Revisar / Autorizar' : 'Ver Detalles'}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Stack>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead sx={{ backgroundColor: 'action.hover' }}>
              <TableRow>
                <TableCell>Nro. OC</TableCell>
                <TableCell>Fecha</TableCell>
                <TableCell>Proveedor ID</TableCell>
                <TableCell>Servicio OS</TableCell>
                <TableCell>Comentarios</TableCell>
                <TableCell align="center">Estado</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {ordenes.map((oc) => (
                <TableRow key={oc.id} hover>
                  <TableCell sx={{ fontWeight: 'bold' }}>#{oc.id}</TableCell>
                  <TableCell>{oc.fecha.split('T')[0]}</TableCell>
                  <TableCell>{oc.proveedorId}</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>#{oc.nroServicio}</TableCell>
                  <TableCell>{oc.comentarios}</TableCell>
                  <TableCell align="center"><Chip size="small" label={formatEstado(oc.estado)} color={oc.estado === 'P' ? 'warning' : 'success'} /></TableCell>
                  <TableCell align="right">
                    <Button size="small" variant={oc.estado === 'P' ? 'contained' : 'outlined'} startIcon={<EditIcon />} onClick={() => navigate(`/tech/ordenes-compra/${oc.id}/edit`)}>
                      {oc.estado === 'P' ? 'Autorizar' : 'Ver'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};