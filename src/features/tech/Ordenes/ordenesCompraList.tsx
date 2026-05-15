import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, TextField, MenuItem, Button, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Chip, Card, Checkbox,
  CardContent, Stack, CircularProgress, useMediaQuery, Autocomplete,
  Dialog, DialogTitle, DialogContent, DialogActions, Divider, TablePagination
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
import { TECH_ENDPOINTS } from '../../../services/endpoints/tech';
import { selectCurrentUser } from '../../auth/authSlice';
import { fetchOrdenesCompra, selectAllOrdenesCompra, selectOrdenesCompraLoading, type ProveedorSAP, type OrdenCompra } from './ordenesCompraSlice';
import { type LlamadaServicio } from '../Llamadas/llamadasSlice';
import { FloatingScrollButtons } from '../../../components/layout/FloatingScrollButtons';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface jsPDFCustom extends jsPDF { lastAutoTable: { finalY: number }; }

interface LiquidacionDetalleRef {
  ordenCompraId: number;
  nroServicio: string;
}

interface LiquidacionRef {
  detalles?: LiquidacionDetalleRef[];
}

interface OrdenServicioInfo {
  clienteId?: string;
  clienteNombre?: string;
  itemIncidenciaId?: string;
  itemIncidenciaDescripcion?: string;
  fecha?: string;
  nroFactura?: string;
  lugarCompra?: string;
}

interface ServicioTecnicoInfo {
  binCode: string;
  descripcion?: string;
}

interface LiquidacionPdfContext {
  liquidacionId?: number;
  servicioTecnicoCodigo?: string;
  servicioTecnicoNombre?: string;
  osInfoByNroServicio?: Record<string, OrdenServicioInfo>;
}

const getServicioLabel = (codigo?: string, nombre?: string) => {
  if (!codigo && !nombre) return '-';
  if (!nombre || nombre === codigo) return codigo || nombre || '-';
  return `${codigo} - ${nombre}`;
};

const formatMoney = (value: number | string | null | undefined) => `$${Number(value || 0).toFixed(2)}`;

const formatDate = (date?: string | null) => date ? date.split('T')[0] : '-';

const formatNroOC = (orden: OrdenCompra) => orden.nroDocumento ? String(orden.nroDocumento) : '-';

const getOrdenTotal = (orden: OrdenCompra) =>
  (orden.detalles || []).reduce((total, detalle) => total + (Number(detalle.precio || 0) * Number(detalle.cantidad || 0)), 0);

const generarPDFLiquidacionOC = (ordenes: OrdenCompra[], context: LiquidacionPdfContext = {}) => {
  const doc = new jsPDF('p', 'pt', 'a4');
  doc.setFontSize(16);
  doc.text(`Liquidación de Órdenes de Compra${context.liquidacionId ? ` #${context.liquidacionId}` : ''}`, 40, 40);
  doc.setFontSize(10);
  doc.text(`Servicio Técnico: ${getServicioLabel(context.servicioTecnicoCodigo, context.servicioTecnicoNombre)}`, 40, 60);
  doc.text(`Fecha: ${formatDate(new Date().toISOString())}`, 40, 76);
  let startY = 105;

  let totalLiquidacion = 0;

  ordenes.forEach((orden, index) => {
    if (startY > 700 && index > 0) {
      doc.addPage();
      startY = 40;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Nro. OC ${formatNroOC(orden)} - OS #${orden.nroServicio}`, 40, startY);
    startY += 20;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Servicio Técnico origen: ${getServicioLabel(orden.ubicacionServicioTecnico || context.servicioTecnicoCodigo, context.servicioTecnicoNombre)}`, 40, startY);
    startY += 18;
    const osInfo = context.osInfoByNroServicio?.[String(orden.nroServicio)];
    doc.text(`Cliente: ${osInfo?.clienteId || '-'} - ${osInfo?.clienteNombre || '-'}`, 40, startY);
    startY += 16;
    doc.text(`Equipo: ${osInfo?.itemIncidenciaId || '-'} - ${osInfo?.itemIncidenciaDescripcion || '-'}`, 40, startY);
    startY += 16;
    doc.text(`Factura: ${osInfo?.nroFactura || '-'}   Lugar Compra: ${osInfo?.lugarCompra || '-'}   Fecha OS: ${formatDate(osInfo?.fecha)}`, 40, startY);
    startY += 20;
    totalLiquidacion += getOrdenTotal(orden);

    if (orden.detalles && orden.detalles.length > 0) {
      const tableData = orden.detalles.map(d => [
        d.item,
        d.descripcion,
        String(d.cantidad),
        formatMoney(d.precio),
        formatMoney(Number(d.precio) * d.cantidad)
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

  if (startY > 700) {
    doc.addPage();
    startY = 40;
  }

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total liquidación: ${formatMoney(totalLiquidacion)}`, 40, startY + 10);

  doc.save(`Liquidacion_OC_${context.liquidacionId || new Date().getTime()}.pdf`);
};

const getOneMonthAgoDate = () => {
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  return date.toISOString().split('T')[0];
};

const RECORDS_PER_PAGE = 15;

const extractLiquidaciones = (rawData: unknown): LiquidacionRef[] => {
  if (Array.isArray(rawData)) return rawData as LiquidacionRef[];
  if (!rawData || typeof rawData !== 'object') return [];
  const data = rawData as { items?: LiquidacionRef[]; registros?: LiquidacionRef[]; data?: LiquidacionRef[] };
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.registros)) return data.registros;
  if (Array.isArray(data.data)) return data.data;
  return [];
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

  const [pagina, setPagina] = useState(1);
  const [proveedores, setProveedores] = useState<ProveedorSAP[]>([]);
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState<ProveedorSAP | null>(null);
  const [isSearchingProv, setIsSearchingProv] = useState(false);

  const [selectedParaLiquidar, setSelectedParaLiquidar] = useState<number[]>([]);
  const [isLiquidando, setIsLiquidando] = useState(false);
  const [ordenesConLiquidacion, setOrdenesConLiquidacion] = useState<Set<number>>(new Set());
  const [osInfoByNroServicio, setOsInfoByNroServicio] = useState<Record<string, OrdenServicioInfo>>({});
  const [serviciosTecnicos, setServiciosTecnicos] = useState<Record<string, string>>({});

  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [ocToPreview, setOcToPreview] = useState<OrdenCompra | null>(null);

  const ordenesVisibles = ordenes.filter((orden) => orden.estado !== 'L');
  const ordenesSeleccionables = ordenesVisibles.filter((orden) => orden.estado === 'A' && !ordenesConLiquidacion.has(orden.id));

  useEffect(() => {
    cargarOrdenes();
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

  useEffect(() => {
    const cargarInfoOrdenesServicio = async () => {
      const numerosServicio = Array.from(
        new Set(ordenesVisibles.map((orden) => String(orden.nroServicio || '')).filter(Boolean))
      ).filter((nroServicio) => !osInfoByNroServicio[nroServicio]);

      if (numerosServicio.length === 0) return;

      const resultados = await Promise.allSettled(
        numerosServicio.map(async (nroServicio) => {
          const res = await api.get<LlamadaServicio>(TECH_ENDPOINTS.GET_LLAMADA_BY_ID(nroServicio));
          return { nroServicio, llamada: res.data };
        })
      );

      const next: Record<string, OrdenServicioInfo> = {};
      resultados.forEach((resultado) => {
        if (resultado.status !== 'fulfilled') return;
        const { nroServicio, llamada } = resultado.value;
        next[nroServicio] = {
          clienteId: llamada.clienteId,
          clienteNombre: llamada.clienteNombre,
          itemIncidenciaId: llamada.itemIncidenciaId,
          itemIncidenciaDescripcion: llamada.itemIncidenciaDescripcion,
          fecha: llamada.fecha,
          nroFactura: llamada.nroFactura,
          lugarCompra: llamada.lugarCompra,
        };
      });

      if (Object.keys(next).length > 0) {
        setOsInfoByNroServicio((prev) => ({ ...prev, ...next }));
      }
    };

    cargarInfoOrdenesServicio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordenesVisibles]);

  const cargarLiquidacionesRelacionadas = async () => {
    if (isFT1 || !user?.idbranch || !user?.ubicacion) {
      setOrdenesConLiquidacion(new Set());
      return;
    }

    const ids = new Set<number>();
    const pageSize = 100;
    let page = 1;

    while (true) {
      const params = new URLSearchParams({
        Pagina: String(page),
        RecordsPorPagina: String(pageSize),
        Bodega: user.idbranch,
        Ubicacion: user.ubicacion,
      });
      const res = await api.get<unknown>(`${TECH_ENDPOINTS.GET_LIQUIDACIONES}?${params.toString()}`);
      const liquidaciones = extractLiquidaciones(res.data);
      liquidaciones.forEach((liquidacion) => {
        (liquidacion.detalles || []).forEach((detalle) => ids.add(Number(detalle.ordenCompraId)));
      });
      if (liquidaciones.length < pageSize) break;
      page += 1;
    }

    setOrdenesConLiquidacion(ids);
  };

  const cargarOrdenes = async () => {
    await dispatch(fetchOrdenesCompra({
      pagina,
      recordsPorPagina: RECORDS_PER_PAGE,
      fechaDesde: filtros.fechaDesde || undefined,
      fechaHasta: filtros.fechaHasta || undefined,
      estado: isFT1 ? filtros.estado : 'A',
      nroServicio: filtros.nroServicio || undefined,
      proveedorId: isFT1 ? (proveedorSeleccionado ? proveedorSeleccionado.cardCode : undefined) : `${user?.ubicacion.replace('05-', '')}-P`
    })).unwrap();
    await cargarLiquidacionesRelacionadas();
    setSelectedParaLiquidar([]);
  };

  const handleApplyFilters = () => {
    if (pagina === 1) cargarOrdenes();
    else setPagina(1);
  };

  const optimisticCount = (pagina - 1) * RECORDS_PER_PAGE + ordenesVisibles.length + (ordenes.length === RECORDS_PER_PAGE ? 1 : 0);

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
    if (ordenesConLiquidacion.has(id)) return;
    setSelectedParaLiquidar(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedParaLiquidar(ordenesVisibles.filter(o => o.estado === 'A' && !ordenesConLiquidacion.has(o.id)).map(o => o.id));
    } else {
      setSelectedParaLiquidar([]);
    }
  };

  const handleMarcarLiquidada = async (id: number) => {
    setIsLiquidando(true);
    try {
      await api.patch(TECH_ENDPOINTS.PATCH_ORDEN_COMPRA_ESTADO(id), { estado: 'L' });
      toast.success('Orden marcada como liquidada.');
      await cargarOrdenes();
    } catch (error) {
      toast.error('No se pudo cambiar el estado de la orden.');
      console.error(error);
    } finally {
      setIsLiquidando(false);
    }
  };

  const cargarInfoOSParaOrdenes = async (ordenesParaImprimir: OrdenCompra[]) => {
    const next: Record<string, OrdenServicioInfo> = {};
    const numerosServicio = Array.from(new Set(ordenesParaImprimir.map((orden) => String(orden.nroServicio || '')).filter(Boolean)));

    await Promise.allSettled(
      numerosServicio.map(async (nroServicio) => {
        if (osInfoByNroServicio[nroServicio]) {
          next[nroServicio] = osInfoByNroServicio[nroServicio];
          return;
        }

        const llamadaRes = await api.get<LlamadaServicio>(TECH_ENDPOINTS.GET_LLAMADA_BY_ID(nroServicio));
        next[nroServicio] = {
          clienteId: llamadaRes.data.clienteId,
          clienteNombre: llamadaRes.data.clienteNombre,
          itemIncidenciaId: llamadaRes.data.itemIncidenciaId,
          itemIncidenciaDescripcion: llamadaRes.data.itemIncidenciaDescripcion,
          fecha: llamadaRes.data.fecha,
          nroFactura: llamadaRes.data.nroFactura,
          lugarCompra: llamadaRes.data.lugarCompra,
        };
      })
    );

    if (Object.keys(next).length > 0) {
      setOsInfoByNroServicio((prev) => ({ ...prev, ...next }));
    }

    return { ...osInfoByNroServicio, ...next };
  };

  const executeLiquidarOC = async () => {
    if (selectedParaLiquidar.length === 0) return;
    setIsLiquidando(true);

    try {
      toast.info("Liquidando órdenes de compra...");
      const ordenesLiquidadas: OrdenCompra[] = [];
      const idsParaLiquidar = selectedParaLiquidar.filter((id) => !ordenesConLiquidacion.has(id));

      if (idsParaLiquidar.length === 0) {
        toast.warning('Las órdenes seleccionadas ya tienen liquidación registrada. Solo falta cambiar estado si siguen visibles.');
        return;
      }

      for (const id of idsParaLiquidar) {
        const res = await api.get<OrdenCompra>(TECH_ENDPOINTS.GET_ORDEN_COMPRA_BY_ID(id));
        if (res.data) ordenesLiquidadas.push(res.data);
      }

      const liquidacionResponse = await api.post(TECH_ENDPOINTS.POST_LIQUIDACION, {
        fecha: new Date().toISOString(),
        bodega: user?.idbranch || '',
        ubicacion: user?.ubicacion || '',
        comentarios: '',
        detalles: ordenesLiquidadas.map((orden) => ({
          ordenCompraId: orden.id,
          nroServicio: String(orden.nroServicio || ''),
        })),
      });

      setOrdenesConLiquidacion((prev) => new Set([...prev, ...idsParaLiquidar]));

      const erroresEstado: number[] = [];
      for (const id of idsParaLiquidar) {
        try {
          await api.patch(TECH_ENDPOINTS.PATCH_ORDEN_COMPRA_ESTADO(id), { estado: 'L' });
        } catch (error) {
          erroresEstado.push(id);
          console.error(error);
        }
      }

      const servicioCodigo = user?.ubicacion || ordenesLiquidadas[0]?.ubicacionServicioTecnico;
      const osInfoParaPDF = await cargarInfoOSParaOrdenes(ordenesLiquidadas);
      generarPDFLiquidacionOC(ordenesLiquidadas, {
        liquidacionId: liquidacionResponse.data?.id,
        servicioTecnicoCodigo: servicioCodigo,
        servicioTecnicoNombre: servicioCodigo ? serviciosTecnicos[servicioCodigo] : undefined,
        osInfoByNroServicio: osInfoParaPDF,
      });

      if (erroresEstado.length > 0) {
        toast.warning(`Liquidación registrada, pero ${erroresEstado.length} orden(es) no cambiaron a estado L. Usa "Cambiar a L".`);
      } else {
        toast.success('Órdenes de Compra liquidadas exitosamente.');
      }
      await cargarOrdenes();
    } catch (error) {
      toast.error("Error al registrar la liquidación. No se cambiaron estados.");
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
      const nroServicio = String(res.data.nroServicio || '');
      if (nroServicio && !osInfoByNroServicio[nroServicio]) {
        const llamadaRes = await api.get<LlamadaServicio>(TECH_ENDPOINTS.GET_LLAMADA_BY_ID(nroServicio));
        setOsInfoByNroServicio((prev) => ({
          ...prev,
          [nroServicio]: {
            clienteId: llamadaRes.data.clienteId,
            clienteNombre: llamadaRes.data.clienteNombre,
            itemIncidenciaId: llamadaRes.data.itemIncidenciaId,
            itemIncidenciaDescripcion: llamadaRes.data.itemIncidenciaDescripcion,
            fecha: llamadaRes.data.fecha,
            nroFactura: llamadaRes.data.nroFactura,
            lugarCompra: llamadaRes.data.lugarCompra,
          },
        }));
      }
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
            <Button variant="contained" color="primary" fullWidth startIcon={<FilterAltIcon />} onClick={handleApplyFilters} sx={{ height: '40px' }}>Filtrar</Button>
          </Grid>
        </Grid>
      </Paper>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>
      ) : ordenesVisibles.length === 0 ? (
        <Paper sx={{ p: 5, textAlign: 'center', borderRadius: 2 }}><Typography color="text.secondary">No se encontraron órdenes de compra.</Typography></Paper>
      ) : isMobile ? (
        <Stack spacing={2}>
          {ordenesVisibles.map((oc) => (
            <Card key={oc.id} elevation={2} sx={{ borderRadius: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {!isFT1 && oc.estado === 'A' && !ordenesConLiquidacion.has(oc.id) && (
                      <Checkbox size="small" sx={{ p: 0 }} checked={selectedParaLiquidar.includes(oc.id)} onChange={() => handleToggleSelect(oc.id)} />
                    )}
                    <Typography variant="subtitle1" fontWeight="bold" color="primary">OC #{formatNroOC(oc)}</Typography>
                  </Box>
                  <Chip size="small" label={formatEstado(oc.estado)} color={oc.estado === 'P' ? 'warning' : 'success'} />
                </Box>
                <Typography variant="body2"><strong>Proveedor:</strong> {oc.proveedorId}</Typography>
                <Typography variant="body2"><strong>Servicio OS:</strong> #{oc.nroServicio}</Typography>
                {osInfoByNroServicio[String(oc.nroServicio)] && (
                  <>
                    <Typography variant="body2"><strong>Cliente:</strong> {osInfoByNroServicio[String(oc.nroServicio)].clienteId || '-'}</Typography>
                    <Typography variant="caption" color="text.secondary" display="block">{osInfoByNroServicio[String(oc.nroServicio)].clienteNombre || '-'}</Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}><strong>Equipo:</strong> {osInfoByNroServicio[String(oc.nroServicio)].itemIncidenciaId || '-'}</Typography>
                    <Typography variant="caption" color="text.secondary" display="block">{osInfoByNroServicio[String(oc.nroServicio)].itemIncidenciaDescripcion || '-'}</Typography>
                  </>
                )}
                <Typography variant="body2"><strong>Fecha:</strong> {oc.fecha.split('T')[0]}</Typography>
                {!isFT1 && ordenesConLiquidacion.has(oc.id) && (
                  <Chip size="small" color="info" variant="outlined" label="Liquidación registrada" sx={{ mt: 1 }} />
                )}
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2, gap: 1 }}>
                  {!isFT1 && ordenesConLiquidacion.has(oc.id) && oc.estado === 'A' && (
                    <Button size="small" variant="contained" color="success" onClick={() => handleMarcarLiquidada(oc.id)} disabled={isLiquidando}>
                      Cambiar a L
                    </Button>
                  )}
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
                      indeterminate={selectedParaLiquidar.length > 0 && selectedParaLiquidar.length < ordenesSeleccionables.length}
                      checked={ordenesSeleccionables.length > 0 && selectedParaLiquidar.length === ordenesSeleccionables.length}
                      onChange={handleSelectAll}
                    />
                  </TableCell>
                )}
                <TableCell>Nro. OC</TableCell>
                <TableCell>Fecha</TableCell>
                <TableCell>Proveedor ID</TableCell>
                <TableCell>Procedencia OS</TableCell>
                <TableCell>Cliente</TableCell>
                <TableCell>Equipo</TableCell>
                <TableCell align="center">Estado</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {ordenesVisibles.map((oc) => (
                <TableRow key={oc.id} hover selected={selectedParaLiquidar.includes(oc.id)}>
                  {!isFT1 && (
                    <TableCell padding="checkbox">
                      {oc.estado === 'A' && !ordenesConLiquidacion.has(oc.id) ? (
                        <Checkbox checked={selectedParaLiquidar.includes(oc.id)} onChange={() => handleToggleSelect(oc.id)} />
                      ) : null}
                    </TableCell>
                  )}
                  <TableCell sx={{ fontWeight: 'bold' }}>#{formatNroOC(oc)}</TableCell>
                  <TableCell>{oc.fecha.split('T')[0]}</TableCell>
                  <TableCell>{oc.proveedorId}</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>#{oc.nroServicio}</TableCell>
                  <TableCell>
                    <Typography variant="body2">{osInfoByNroServicio[String(oc.nroServicio)]?.clienteId || '-'}</Typography>
                    <Typography variant="caption" color="text.secondary">{osInfoByNroServicio[String(oc.nroServicio)]?.clienteNombre || '-'}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{osInfoByNroServicio[String(oc.nroServicio)]?.itemIncidenciaId || '-'}</Typography>
                    <Typography variant="caption" color="text.secondary">{osInfoByNroServicio[String(oc.nroServicio)]?.itemIncidenciaDescripcion || '-'}</Typography>
                  </TableCell>
                  <TableCell align="center"><Chip size="small" label={formatEstado(oc.estado)} color={oc.estado === 'P' ? 'warning' : 'success'} /></TableCell>
                  <TableCell align="right">
                    {!isFT1 && ordenesConLiquidacion.has(oc.id) && oc.estado === 'A' && (
                      <Button size="small" variant="contained" color="success" onClick={() => handleMarcarLiquidada(oc.id)} disabled={isLiquidando} sx={{ mr: 1 }}>
                        Cambiar a L
                      </Button>
                    )}
                    {!isFT1 && ordenesConLiquidacion.has(oc.id) && (
                      <Chip size="small" color="info" variant="outlined" label="Liquidación registrada" sx={{ mr: 1 }} />
                    )}
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

      {ordenesVisibles.length > 0 && (
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

      <Dialog open={previewModalOpen} onClose={() => setPreviewModalOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Detalle de Orden de Compra #{ocToPreview ? formatNroOC(ocToPreview) : '...'}</span>
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
                <Typography variant="body2" color="text.secondary">Cliente</Typography>
                <Typography variant="body1">{osInfoByNroServicio[String(ocToPreview.nroServicio)]?.clienteId || '-'}</Typography>
                <Typography variant="caption" color="text.secondary">{osInfoByNroServicio[String(ocToPreview.nroServicio)]?.clienteNombre || '-'}</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Typography variant="body2" color="text.secondary">Equipo afectado</Typography>
                <Typography variant="body1">{osInfoByNroServicio[String(ocToPreview.nroServicio)]?.itemIncidenciaId || '-'}</Typography>
                <Typography variant="caption" color="text.secondary">{osInfoByNroServicio[String(ocToPreview.nroServicio)]?.itemIncidenciaDescripcion || '-'}</Typography>
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
      <FloatingScrollButtons />
    </Box>
  );
};
