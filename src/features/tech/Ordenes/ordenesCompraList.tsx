import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, TextField, MenuItem, Button, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Chip, Card, Checkbox,
  CardContent, Stack, CircularProgress, useMediaQuery, Autocomplete,
  Dialog, DialogTitle, DialogContent, DialogActions, Divider
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { toast } from 'sonner';

import FilterAltIcon from '@mui/icons-material/FilterAlt';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ShoppingCartCheckoutIcon from '@mui/icons-material/ShoppingCartCheckout';
import TaskAltIcon from '@mui/icons-material/TaskAlt'; 
import IconButton from '@mui/material/IconButton';

import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { useNavigate } from 'react-router-dom';
import api from '../../../services/api';
import { selectCurrentUser } from '../../auth/authSlice';
import { fetchOrdenesCompra, selectAllOrdenesCompra, selectOrdenesCompraLoading, type ProveedorSAP, type OrdenCompra } from './ordenesCompraSlice';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface jsPDFCustom extends jsPDF { lastAutoTable: { finalY: number }; }

const generarPDFLiquidacionOC = (ordenes: OrdenCompra[]) => {
  const doc = new jsPDF('p', 'pt', 'a4'); 
  doc.setFontSize(16);
  doc.text('Liquidación de Órdenes de Compra', 40, 40);
  let startY = 70;

  ordenes.forEach((orden, index) => {
    if (startY > 700 && index > 0) {
      doc.addPage();
      startY = 40;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`OC #${orden.id} - Procedencia (OS Relacionada): #${orden.nroServicio}`, 40, startY);
    startY += 20;

    if (orden.detalles && orden.detalles.length > 0) {
      const tableData = orden.detalles.map(d => [
        d.item,
        d.descripcion,
        String(d.cantidad),
        `$${Number(d.precio).toFixed(2)}`,
        `$${(Number(d.precio) * d.cantidad).toFixed(2)}`
      ]);

      autoTable(doc, {
        startY: startY,
        head: [['Código Ítem', 'Descripción', 'Cant.', 'Precio Unit.', 'Total']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185] },
        styles: { fontSize: 9 },
        margin: { left: 40, right: 40 },
      });

      startY = (doc as unknown as jsPDFCustom).lastAutoTable.finalY + 30; 
    } else {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.text('Sin ítems registrados en esta orden.', 40, startY);
      startY += 30;
    }
  });
  
  doc.save(`Liquidacion_OC_${new Date().getTime()}.pdf`);
};

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

  const user = useAppSelector(selectCurrentUser);
  const ordenes = useAppSelector(selectAllOrdenesCompra);
  const isLoading = useAppSelector(selectOrdenesCompraLoading);

  const isFT1 = user?.ubicacion === '05-FT1';

  const [filtros, setFiltros] = useState({
    fechaDesde: getOneMonthAgoDate(),
    fechaHasta: '',
    estado: isFT1 ? 'P' : 'A', 
    nroServicio: ''
  });

  const [paginacion] = useState({ pagina: 1, recordsPorPagina: 50 });
  const [proveedores, setProveedores] = useState<ProveedorSAP[]>([]);
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState<ProveedorSAP | null>(null);
  const [isSearchingProv, setIsSearchingProv] = useState(false);

  const [selectedParaLiquidar, setSelectedParaLiquidar] = useState<number[]>([]);
  const [isLiquidando, setIsLiquidando] = useState(false);

  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [ocToPreview, setOcToPreview] = useState<OrdenCompra | null>(null);

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
      estado: isFT1 ? filtros.estado : 'A',
      nroServicio: filtros.nroServicio || undefined,
      proveedorId: isFT1 ? (proveedorSeleccionado ? proveedorSeleccionado.cardCode : undefined) : `${user?.ubicacion.replace('05-', '')}-P`
    }));
    setSelectedParaLiquidar([]);
  };

  const buscarProveedores = async (termino: string) => {
    if (termino.length < 3) return;
    setIsSearchingProv(true);
    try {
      const response = await api.get<ProveedorSAP[]>(`/sap/proveedores/pornombre?nombre=${termino}&top=20&skip=0`);
      setProveedores(response.data);
    } catch (error: unknown) {
      toast.error("Error buscando proveedores.");
      console.error(error);
    } finally {
      setIsSearchingProv(false);
    }
  };

  const formatEstado = (estado: string) => {
    return estado === 'P' ? 'PENDIENTE' : estado === 'A' ? 'AUTORIZADA' : estado === 'L' ? 'LIQUIDADA' : estado;
  };

  const handleToggleSelect = (id: number) => {
    setSelectedParaLiquidar(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedParaLiquidar(ordenes.filter(o => o.estado === 'A').map(o => o.id));
    } else {
      setSelectedParaLiquidar([]);
    }
  };

  const executeLiquidarOC = async () => {
    if (selectedParaLiquidar.length === 0) return;
    setIsLiquidando(true);

    try {
      toast.info("Liquidando órdenes de compra...");
      const ordenesLiquidadas: OrdenCompra[] = [];

      for (const id of selectedParaLiquidar) {
        // 1. Cambiamos el estado
        await api.patch(`/ordenes-compra/${id}/estado`, { estado: 'L' });
        // 2. Descargamos la orden completa (con detalles) para el PDF
        const res = await api.get<OrdenCompra>(`/ordenes-compra/${id}`);
        if (res.data) ordenesLiquidadas.push(res.data);
      }

      generarPDFLiquidacionOC(ordenesLiquidadas);
      toast.success('Órdenes de Compra liquidadas exitosamente.');
      cargarOrdenes();
    } catch (error) {
      toast.error("Error al liquidar las órdenes.");
      console.log(error)
    } finally {
      setIsLiquidando(false);
      setSelectedParaLiquidar([]);
    }
  };

  const handleViewPreview = async (id: number) => {
    setPreviewModalOpen(true);
    setIsPreviewLoading(true);
    setOcToPreview(null);
    try {
      const res = await api.get<OrdenCompra>(`/ordenes-compra/${id}`);
      setOcToPreview(res.data);
    } catch (error: unknown) {
      toast.error("Error al cargar los detalles de la orden de compra");
      console.error(error);
      setPreviewModalOpen(false);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  return (
    <Box sx={{ pb: { xs: 10, md: 4 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <ShoppingCartCheckoutIcon color="primary" fontSize="large" />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>Órdenes de Compra</Typography>
            <Typography variant="body2" color="text.secondary">
              {isFT1 ? 'Revisión y Autorización Centralizada' : 'Órdenes Autorizadas para Liquidación'}
            </Typography>
          </Box>
        </Box>

        {!isFT1 && selectedParaLiquidar.length > 0 && (
          <Button 
            variant="contained" color="secondary" startIcon={isLiquidando ? <CircularProgress size={20} color="inherit" /> : <TaskAltIcon />} 
            onClick={executeLiquidarOC} disabled={isLiquidando}
          >
            Liquidar ({selectedParaLiquidar.length})
          </Button>
        )}
      </Box>

      <Paper sx={{ p: { xs: 2, md: 3 }, mb: 3, borderRadius: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <TextField label="Fecha Desde" type="date" fullWidth size="small" InputLabelProps={{ shrink: true }} value={filtros.fechaDesde} onChange={(e) => setFiltros({ ...filtros, fechaDesde: e.target.value })} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <TextField label="Fecha Hasta" type="date" fullWidth size="small" InputLabelProps={{ shrink: true }} value={filtros.fechaHasta} onChange={(e) => setFiltros({ ...filtros, fechaHasta: e.target.value })} />
          </Grid>
          
          {isFT1 && (
            <>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Autocomplete
                  size="small"
                  options={proveedores}
                  getOptionLabel={(option) => `${option.cardCode} - ${option.cardName}`}
                  loading={isSearchingProv}
                  onInputChange={(_e, value) => buscarProveedores(value)}
                  onChange={(_e, value) => setProveedorSeleccionado(value)}
                  renderInput={(params) => <TextField {...params} label="Buscar Proveedor" variant="outlined" InputProps={{ ...params.InputProps, endAdornment: (<>{isSearchingProv ? <CircularProgress color="inherit" size={20} /> : null}{params.InputProps.endAdornment}</>) }} />}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 1 }}>
                <TextField select label="Estado" fullWidth size="small" value={filtros.estado} onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}>
                  <MenuItem value="TODOS">Todos</MenuItem>
                  <MenuItem value="P">Pendiente</MenuItem>
                  <MenuItem value="A">Autorizada</MenuItem>
                </TextField>
              </Grid>
            </>
          )}

          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <TextField label="Nro. OS" fullWidth size="small" value={filtros.nroServicio} onChange={(e) => setFiltros({ ...filtros, nroServicio: e.target.value })} />
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
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {!isFT1 && oc.estado === 'A' && (
                      <Checkbox size="small" sx={{ p: 0 }} checked={selectedParaLiquidar.includes(oc.id)} onChange={() => handleToggleSelect(oc.id)} />
                    )}
                    <Typography variant="subtitle1" fontWeight="bold" color="primary">OC #{oc.id}</Typography>
                  </Box>
                  <Chip size="small" label={formatEstado(oc.estado)} color={oc.estado === 'P' ? 'warning' : 'success'} />
                </Box>
                <Typography variant="body2"><strong>Proveedor:</strong> {oc.proveedorId}</Typography>
                <Typography variant="body2"><strong>Servicio OS:</strong> #{oc.nroServicio}</Typography>
                <Typography variant="body2"><strong>Fecha:</strong> {oc.fecha.split('T')[0]}</Typography>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2, gap: 1 }}>
                  <IconButton color="info" size="small" onClick={() => handleViewPreview(oc.id)}>
                    <VisibilityIcon />
                  </IconButton>
                  <Button size="small" variant="contained" startIcon={<EditIcon />} onClick={() => navigate(`/tech/ordenes-compra/${oc.id}/edit`)}>
                    {isFT1 && oc.estado === 'P' ? 'Revisar' : 'Detalle'}
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
                {!isFT1 && (
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={selectedParaLiquidar.length > 0 && selectedParaLiquidar.length < ordenes.length}
                      checked={ordenes.length > 0 && selectedParaLiquidar.length === ordenes.length}
                      onChange={handleSelectAll}
                    />
                  </TableCell>
                )}
                <TableCell>Nro. OC</TableCell>
                <TableCell>Fecha</TableCell>
                <TableCell>Proveedor ID</TableCell>
                <TableCell>Procedencia OS</TableCell>
                <TableCell align="center">Estado</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {ordenes.map((oc) => (
                <TableRow key={oc.id} hover selected={selectedParaLiquidar.includes(oc.id)}>
                  {!isFT1 && (
                    <TableCell padding="checkbox">
                      {oc.estado === 'A' ? (
                        <Checkbox checked={selectedParaLiquidar.includes(oc.id)} onChange={() => handleToggleSelect(oc.id)} />
                      ) : null}
                    </TableCell>
                  )}
                  <TableCell sx={{ fontWeight: 'bold' }}>#{oc.id}</TableCell>
                  <TableCell>{oc.fecha.split('T')[0]}</TableCell>
                  <TableCell>{oc.proveedorId}</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>#{oc.nroServicio}</TableCell>
                  <TableCell align="center"><Chip size="small" label={formatEstado(oc.estado)} color={oc.estado === 'P' ? 'warning' : 'success'} /></TableCell>
                  <TableCell align="right">
                    <IconButton color="info" title="Ver Ítems" onClick={() => handleViewPreview(oc.id)}>
                      <VisibilityIcon />
                    </IconButton>
                    <Button size="small" variant={isFT1 && oc.estado === 'P' ? 'contained' : 'outlined'} startIcon={<EditIcon />} onClick={() => navigate(`/tech/ordenes-compra/${oc.id}/edit`)} sx={{ ml: 1 }}>
                      {isFT1 && oc.estado === 'P' ? 'Autorizar' : 'Edición'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={previewModalOpen} onClose={() => setPreviewModalOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Detalle de Orden de Compra #{ocToPreview?.id || '...'}</span>
          {ocToPreview && (
            <Chip label={formatEstado(ocToPreview.estado)} color={ocToPreview.estado === 'P' ? 'warning' : 'success'} sx={{ fontWeight: 'bold' }} />
          )}
        </DialogTitle>
        <DialogContent dividers sx={{ minHeight: '250px' }}>
          {isPreviewLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <CircularProgress />
            </Box>
          ) : ocToPreview ? (
            <Grid container spacing={3}>
              <Grid size={{ xs: 12 }}>
                <Typography variant="subtitle1" color="primary" fontWeight="bold">Procedencia y General</Typography>
                <Divider sx={{ mb: 2 }} />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Typography variant="body2" color="text.secondary">OS Relacionada</Typography>
                <Typography variant="body1" fontWeight="bold">#{ocToPreview.nroServicio}</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Typography variant="body2" color="text.secondary">Proveedor SAP</Typography>
                <Typography variant="body1">{ocToPreview.proveedorId}</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Typography variant="body2" color="text.secondary">Fecha de Emisión</Typography>
                <Typography variant="body1">{ocToPreview.fecha.split('T')[0]}</Typography>
              </Grid>

              <Grid size={{ xs: 12 }} sx={{ mt: 2 }}>
                <Typography variant="subtitle1" color="primary" fontWeight="bold">Ítems Requeridos</Typography>
                <Divider sx={{ mb: 2 }} />
                
                {(!ocToPreview.detalles || ocToPreview.detalles.length === 0) ? (
                  <Typography variant="body2" color="text.secondary">No hay detalles registrados en esta orden.</Typography>
                ) : (
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead sx={{ bgcolor: 'action.hover' }}>
                        <TableRow>
                          <TableCell>Código Ítem</TableCell>
                          <TableCell>Descripción</TableCell>
                          <TableCell align="center">Bodega</TableCell>
                          <TableCell align="center">Cant.</TableCell>
                          <TableCell align="right">Precio Unit.</TableCell>
                          <TableCell align="right">Total</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {ocToPreview.detalles.map((d) => (
                          <TableRow key={d.id}>
                            <TableCell>{d.item}</TableCell>
                            <TableCell>{d.descripcion}</TableCell>
                            <TableCell align="center"><Chip size="small" label={d.bodega} variant="outlined" /></TableCell>
                            <TableCell align="center">{d.cantidad}</TableCell>
                            <TableCell align="right">${Number(d.precio).toFixed(2)}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                              ${(Number(d.precio) * d.cantidad).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Grid>
            </Grid>
          ) : (
            <Typography align="center" color="text.secondary">No se pudo cargar la información.</Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setPreviewModalOpen(false)} color="inherit">Cerrar Visor</Button>
          {ocToPreview && isFT1 && ocToPreview.estado === 'P' && (
            <Button 
              variant="contained" color="primary" startIcon={<EditIcon />} 
              onClick={() => { setPreviewModalOpen(false); navigate(`/tech/ordenes-compra/${ocToPreview.id}/edit`); }}
            >
              Ir a Autorizar
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};
