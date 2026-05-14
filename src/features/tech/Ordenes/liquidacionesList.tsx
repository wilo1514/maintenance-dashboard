import { useEffect, useState } from 'react';
import {
  Autocomplete, Box, Button, Card, CardContent, Chip, CircularProgress, Grid,
  Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Paper, Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TablePagination, TableRow, TextField, Typography, useMediaQuery
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import VisibilityIcon from '@mui/icons-material/Visibility';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import PrintIcon from '@mui/icons-material/Print';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import api from '../../../services/api';
import { TECH_ENDPOINTS } from '../../../services/endpoints/tech';
import { useAppSelector } from '../../../app/hooks';
import { selectCurrentUser } from '../../auth/authSlice';
import { type OrdenCompra, type ProveedorSAP } from './ordenesCompraSlice';
import { FloatingScrollButtons } from '../../../components/layout/FloatingScrollButtons';

interface LiquidacionDetalle {
  id?: number;
  ordenCompraId: number;
  nroServicio: string;
}

interface Liquidacion {
  id: number;
  fecha: string;
  bodega: string;
  ubicacion: string;
  comentarios?: string;
  proveedorId?: string;
  proveedorNombre?: string;
  nroDetalles?: number;
  detalles: LiquidacionDetalle[];
}

const RECORDS_PER_PAGE = 15;

interface jsPDFCustom extends jsPDF { lastAutoTable: { finalY: number }; }

interface ServicioTecnicoInfo {
  binCode: string;
  descripcion?: string;
}

interface LiquidacionPdfContext {
  liquidacionId?: number;
  servicioTecnicoCodigo?: string;
  servicioTecnicoNombre?: string;
}

const getServicioLabel = (codigo?: string, nombre?: string) => {
  if (!codigo && !nombre) return '-';
  if (!nombre || nombre === codigo) return codigo || nombre || '-';
  return `${codigo} - ${nombre}`;
};

const generarPDFLiquidacionOC = (ordenes: OrdenCompra[], context: LiquidacionPdfContext = {}) => {
  const doc = new jsPDF('p', 'pt', 'a4');
  doc.setFontSize(16);
  doc.text(`Liquidación de Órdenes de Compra${context.liquidacionId ? ` #${context.liquidacionId}` : ''}`, 40, 40);
  doc.setFontSize(10);
  doc.text(`Servicio Técnico: ${getServicioLabel(context.servicioTecnicoCodigo, context.servicioTecnicoNombre)}`, 40, 60);
  let startY = 90;

  ordenes.forEach((orden, index) => {
    if (startY > 700 && index > 0) {
      doc.addPage();
      startY = 40;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`OC #${orden.id} - Procedencia (OS Relacionada): #${orden.nroServicio}`, 40, startY);
    startY += 20;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Servicio Técnico origen: ${getServicioLabel(orden.ubicacionServicioTecnico || context.servicioTecnicoCodigo, context.servicioTecnicoNombre)}`, 40, startY);
    startY += 18;

    if (orden.detalles && orden.detalles.length > 0) {
      const tableData = orden.detalles.map((detalle) => [
        detalle.item,
        detalle.descripcion,
        String(detalle.cantidad),
        `$${Number(detalle.precio).toFixed(2)}`,
        `$${(Number(detalle.precio) * detalle.cantidad).toFixed(2)}`
      ]);

      autoTable(doc, {
        startY,
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

  doc.save(`Liquidacion_OC_${context.liquidacionId || new Date().getTime()}.pdf`);
};

const getOneMonthAgoDate = () => {
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  return date.toISOString().split('T')[0];
};

const extractLiquidaciones = (rawData: unknown): Liquidacion[] => {
  if (Array.isArray(rawData)) return rawData as Liquidacion[];
  if (!rawData || typeof rawData !== 'object') return [];
  const data = rawData as { items?: Liquidacion[]; registros?: Liquidacion[]; data?: Liquidacion[] };
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.registros)) return data.registros;
  if (Array.isArray(data.data)) return data.data;
  return [];
};

export const LiquidacionesList = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const user = useAppSelector(selectCurrentUser);
  const isFT1 = user?.ubicacion === '05-FT1';

  const [liquidaciones, setLiquidaciones] = useState<Liquidacion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [filtros, setFiltros] = useState({
    fechaDesde: getOneMonthAgoDate(),
    fechaHasta: '',
  });
  const [proveedores, setProveedores] = useState<ProveedorSAP[]>([]);
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState<ProveedorSAP | null>(null);
  const [isSearchingProv, setIsSearchingProv] = useState(false);
  const [selectedLiquidacion, setSelectedLiquidacion] = useState<Liquidacion | null>(null);
  const [selectedOrdenes, setSelectedOrdenes] = useState<OrdenCompra[]>([]);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [serviciosTecnicos, setServiciosTecnicos] = useState<Record<string, string>>({});

  const cargarLiquidaciones = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        Pagina: String(pagina),
        RecordsPorPagina: String(RECORDS_PER_PAGE),
      });

      if (!isFT1) {
        if (user?.idbranch) params.append('Bodega', user.idbranch);
        if (user?.ubicacion) params.append('Ubicacion', user.ubicacion);
      }

      if (filtros.fechaDesde) params.append('FechaDesde', filtros.fechaDesde);
      if (filtros.fechaHasta) params.append('FechaHasta', filtros.fechaHasta);
      if (isFT1 && proveedorSeleccionado) params.append('ProveedorId', proveedorSeleccionado.cardCode);

      const res = await api.get<unknown>(`${TECH_ENDPOINTS.GET_LIQUIDACIONES}?${params.toString()}`);
      setLiquidaciones(extractLiquidaciones(res.data));
    } catch (error) {
      toast.error('Error al cargar liquidaciones.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    cargarLiquidaciones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagina]);

  useEffect(() => {
    const cargarServiciosTecnicos = async () => {
      try {
        const res = await api.get<ServicioTecnicoInfo[]>(TECH_ENDPOINTS.GET_SAP_UBICACIONES('05'));
        const map = (res.data || []).reduce<Record<string, string>>((acc, item) => {
          if (item.binCode) acc[item.binCode] = item.descripcion || item.binCode;
          return acc;
        }, {});
        setServiciosTecnicos(map);
      } catch (error) {
        console.error(error);
      }
    };

    cargarServiciosTecnicos();
  }, []);

  const handleApplyFilters = () => {
    if (pagina === 1) cargarLiquidaciones();
    else setPagina(1);
  };

  const buscarProveedores = async (termino: string) => {
    if (termino.length < 3) return;
    setIsSearchingProv(true);
    try {
      const response = await api.get<ProveedorSAP[]>(`/sap/proveedores/pornombre?nombre=${termino}&top=20&skip=0`);
      setProveedores(response.data);
    } catch (error: unknown) {
      toast.error('Error buscando proveedores.');
      console.error(error);
    } finally {
      setIsSearchingProv(false);
    }
  };

  const cargarLiquidacionDetalle = async (id: number) => {
    const res = await api.get<Liquidacion>(TECH_ENDPOINTS.GET_LIQUIDACION_BY_ID(id));
    return res.data;
  };

  const cargarOrdenesLiquidacion = async (liquidacion: Liquidacion) => {
    const resultados = await Promise.allSettled(
      (liquidacion.detalles || []).map(async (detalle) => {
        const res = await api.get<OrdenCompra>(TECH_ENDPOINTS.GET_ORDEN_COMPRA_BY_ID(detalle.ordenCompraId));
        return res.data;
      })
    );

    return resultados
      .filter((resultado): resultado is PromiseFulfilledResult<OrdenCompra> => resultado.status === 'fulfilled')
      .map((resultado) => resultado.value);
  };

  const handleViewLiquidacion = async (id: number) => {
    setSelectedLiquidacion(null);
    setSelectedOrdenes([]);
    setIsDetailLoading(true);
    try {
      const liquidacion = await cargarLiquidacionDetalle(id);
      const ordenes = await cargarOrdenesLiquidacion(liquidacion);
      setSelectedLiquidacion(liquidacion);
      setSelectedOrdenes(ordenes);
    } catch (error) {
      toast.error('No se pudo cargar el detalle de la liquidación.');
      console.error(error);
    } finally {
      setIsDetailLoading(false);
    }
  };

  const optimisticCount = (pagina - 1) * RECORDS_PER_PAGE + liquidaciones.length + (liquidaciones.length === RECORDS_PER_PAGE ? 1 : 0);

  const handleReimprimir = async (liquidacion: Liquidacion) => {
    try {
      toast.info('Preparando PDF de liquidación...');
      const liquidacionDetalle = await cargarLiquidacionDetalle(liquidacion.id);
      const ordenes = await cargarOrdenesLiquidacion(liquidacionDetalle);
      generarPDFLiquidacionOC(ordenes, {
        liquidacionId: liquidacionDetalle.id,
        servicioTecnicoCodigo: liquidacionDetalle.ubicacion,
        servicioTecnicoNombre: serviciosTecnicos[liquidacionDetalle.ubicacion],
      });
      toast.success('PDF generado.');
    } catch (error) {
      toast.error('No se pudo reimprimir la liquidación.');
      console.error(error);
    }
  };

  return (
    <Box sx={{ pb: { xs: 10, md: 4 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <ReceiptLongIcon color="primary" fontSize="large" />
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 'bold' }}>Órdenes Liquidadas</Typography>
          <Typography variant="body2" color="text.secondary">
            {isFT1 ? 'Liquidaciones de los servicios técnicos' : 'Liquidaciones realizadas por tu servicio técnico'}
          </Typography>
        </Box>
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
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
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
          )}
          <Grid size={{ xs: 12, md: 2 }}>
            <Button variant="contained" fullWidth startIcon={<FilterAltIcon />} onClick={handleApplyFilters} sx={{ height: '40px' }}>
              Filtrar
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>
      ) : liquidaciones.length === 0 ? (
        <Paper sx={{ p: 5, textAlign: 'center', borderRadius: 2 }}>
          <Typography color="text.secondary">No se encontraron liquidaciones.</Typography>
        </Paper>
      ) : isMobile ? (
        <Stack spacing={2}>
          {liquidaciones.map((liq) => (
            <Card key={liq.id} elevation={2} sx={{ borderRadius: 2 }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="subtitle1" fontWeight="bold" color="primary">Liquidación #{liq.id}</Typography>
                  <Chip size="small" color="success" label="LIQUIDADA" />
                </Stack>
                <Typography variant="body2"><strong>Fecha:</strong> {liq.fecha?.split('T')[0] || 'S/F'}</Typography>
                <Typography variant="body2"><strong>Servicio Técnico:</strong> {getServicioLabel(liq.ubicacion, serviciosTecnicos[liq.ubicacion])}</Typography>
                <Typography variant="body2"><strong>Bodega:</strong> {liq.bodega || '-'}</Typography>
                <Typography variant="body2"><strong>Órdenes:</strong> {liq.detalles?.length || liq.nroDetalles || 0}</Typography>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2, gap: 1 }}>
                  <IconButton color="success" size="small" onClick={() => handleReimprimir(liq)}>
                    <PrintIcon />
                  </IconButton>
                  <IconButton color="info" size="small" onClick={() => handleViewLiquidacion(liq.id)}>
                    <VisibilityIcon />
                  </IconButton>
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
                <TableCell>Nro.</TableCell>
                <TableCell>Fecha</TableCell>
                <TableCell>Bodega</TableCell>
                <TableCell>Servicio Técnico</TableCell>
                <TableCell>Órdenes / OS</TableCell>
                <TableCell>Comentarios</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {liquidaciones.map((liq) => (
                <TableRow key={liq.id} hover>
                  <TableCell sx={{ fontWeight: 'bold' }}>#{liq.id}</TableCell>
                  <TableCell>{liq.fecha?.split('T')[0] || 'S/F'}</TableCell>
                  <TableCell>{liq.bodega || '-'}</TableCell>
                  <TableCell>{getServicioLabel(liq.ubicacion, serviciosTecnicos[liq.ubicacion])}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {(liq.detalles || []).map((detalle) => (
                        <Chip key={`${liq.id}-${detalle.ordenCompraId}`} size="small" variant="outlined" label={`OC ${detalle.ordenCompraId} / OS ${detalle.nroServicio}`} />
                      ))}
                    </Stack>
                  </TableCell>
                  <TableCell>{liq.comentarios || '-'}</TableCell>
                  <TableCell align="right">
                    <IconButton color="success" title="Reimprimir liquidación" onClick={() => handleReimprimir(liq)}>
                      <PrintIcon />
                    </IconButton>
                    <IconButton color="info" title="Ver liquidación" onClick={() => handleViewLiquidacion(liq.id)}>
                      <VisibilityIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {liquidaciones.length > 0 && (
        <TablePagination
          component="div"
          count={optimisticCount}
          page={pagina - 1}
          onPageChange={(_, newPage) => setPagina(newPage + 1)}
          rowsPerPage={RECORDS_PER_PAGE}
          rowsPerPageOptions={[]}
          labelRowsPerPage=""
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
        />
      )}

      <Dialog
        open={!!selectedLiquidacion || isDetailLoading}
        onClose={() => { setSelectedLiquidacion(null); setSelectedOrdenes([]); }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 'bold' }}>
          Liquidación #{selectedLiquidacion?.id}
        </DialogTitle>
        <DialogContent dividers>
          {isDetailLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
              <CircularProgress />
            </Box>
          ) : selectedLiquidacion && (
            <Stack spacing={2}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Typography variant="body2" color="text.secondary">Fecha</Typography>
                  <Typography variant="body1">{selectedLiquidacion.fecha?.split('T')[0] || 'S/F'}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Typography variant="body2" color="text.secondary">Bodega</Typography>
                  <Typography variant="body1">{selectedLiquidacion.bodega || '-'}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Typography variant="body2" color="text.secondary">Servicio Técnico</Typography>
                  <Typography variant="body1">{getServicioLabel(selectedLiquidacion.ubicacion, serviciosTecnicos[selectedLiquidacion.ubicacion])}</Typography>
                </Grid>
              </Grid>
              <Stack spacing={2}>
                {selectedOrdenes.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">No se pudieron cargar órdenes de compra para esta liquidación.</Typography>
                ) : selectedOrdenes.map((orden) => (
                  <Paper key={orden.id} variant="outlined" sx={{ p: 2 }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1} sx={{ mb: 1 }}>
                      <Box>
                        <Typography variant="subtitle1" fontWeight="bold">OC #{orden.id}</Typography>
                        <Typography variant="body2" color="text.secondary">OS Relacionada: #{orden.nroServicio}</Typography>
                      </Box>
                      <Chip size="small" label={getServicioLabel(orden.ubicacionServicioTecnico || selectedLiquidacion.ubicacion, serviciosTecnicos[orden.ubicacionServicioTecnico || selectedLiquidacion.ubicacion])} />
                    </Stack>
                    <TableContainer>
                      <Table size="small">
                        <TableHead sx={{ bgcolor: 'action.hover' }}>
                          <TableRow>
                            <TableCell>Código Ítem</TableCell>
                            <TableCell>Descripción</TableCell>
                            <TableCell align="center">Cant.</TableCell>
                            <TableCell align="right">Precio Unit.</TableCell>
                            <TableCell align="right">Total</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {(orden.detalles || []).map((detalle) => (
                            <TableRow key={detalle.id}>
                              <TableCell>{detalle.item}</TableCell>
                              <TableCell>{detalle.descripcion}</TableCell>
                              <TableCell align="center">{detalle.cantidad}</TableCell>
                              <TableCell align="right">${Number(detalle.precio).toFixed(2)}</TableCell>
                              <TableCell align="right">${(Number(detalle.precio) * detalle.cantidad).toFixed(2)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Paper>
                ))}
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {selectedLiquidacion.comentarios || 'Sin comentarios.'}
              </Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          {selectedLiquidacion && (
            <Button onClick={() => handleReimprimir(selectedLiquidacion)} color="success" variant="contained" startIcon={<PrintIcon />}>
              Reimprimir PDF
            </Button>
          )}
          <Button onClick={() => { setSelectedLiquidacion(null); setSelectedOrdenes([]); }} color="inherit">Cerrar</Button>
        </DialogActions>
      </Dialog>

      <FloatingScrollButtons />
    </Box>
  );
};
