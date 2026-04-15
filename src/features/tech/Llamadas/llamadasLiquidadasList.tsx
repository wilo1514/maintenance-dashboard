import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, TextField, Button, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Chip, Card,
  CardContent, Stack, CircularProgress, useMediaQuery, Avatar, Checkbox
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { toast } from 'sonner';

import FilterAltIcon from '@mui/icons-material/FilterAlt';
import DownloadIcon from '@mui/icons-material/Download';
import TaskAltIcon from '@mui/icons-material/TaskAlt'; 

import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import api from '../../../services/api';
import { TECH_ENDPOINTS } from '../../../services/endpoints/tech';
import { fetchLlamadas, selectAllLlamadas, selectLlamadasLoading, type LlamadaServicio } from './llamadasSlice';
import { generarPDFLiquidacion } from '../../../utils/pdfLiquidacion'; 

const getOneMonthAgoDate = () => {
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  return date.toISOString().split('T')[0]; 
};

export const LlamadasLiquidadasList = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const dispatch = useAppDispatch();

  const llamadas = useAppSelector(selectAllLlamadas);
  const isLoading = useAppSelector(selectLlamadasLoading);

  const [filtros, setFiltros] = useState({
    fechaDesde: getOneMonthAgoDate(),
    fechaHasta: '',
    estado: 'L'
  });

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    dispatch(fetchLlamadas(filtros));
  }, [dispatch]);

  const handleApplyFilters = () => {
    dispatch(fetchLlamadas(filtros));
    setSelectedIds([]); 
  };

  const handleToggleSelect = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedIds(llamadas.map(ll => ll.id));
    } else {
      setSelectedIds([]);
    }
  };

  const executeDownloadPDF = async () => {
    if (selectedIds.length === 0) return;
    setIsDownloading(true);

    try {
      toast.info("Recopilando información para el PDF...");
      const ordenesCompletas: LlamadaServicio[] = [];

      for (const id of selectedIds) {
        const res = await api.get<LlamadaServicio>(TECH_ENDPOINTS.GET_LLAMADA_BY_ID(id));
        ordenesCompletas.push(res.data);
      }

      generarPDFLiquidacion(ordenesCompletas);
      toast.success('PDF generado con éxito.');
      setSelectedIds([]); 
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : "Ocurrió un error al descargar los detalles";
      toast.error(errMsg);
      console.error(error);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Box sx={{ pb: { xs: 10, md: 4 } }}>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar sx={{ bgcolor: 'primary.main' }}><TaskAltIcon /></Avatar>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>Órdenes Liquidadas</Typography>
            <Typography variant="body2" color="text.secondary">Historial y reimpresión de PDFs</Typography>
          </Box>
        </Box>
        
        {selectedIds.length > 0 && (
          <Button 
            variant="contained" color="secondary" 
            startIcon={isDownloading ? <CircularProgress size={20} color="inherit" /> : <DownloadIcon />} 
            onClick={executeDownloadPDF} disabled={isDownloading}
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          >
            Descargar PDF ({selectedIds.length})
          </Button>
        )}
      </Box>

      <Paper sx={{ p: { xs: 2, md: 3 }, mb: 3, borderRadius: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, sm: 4, md: 4 }}>
            <TextField 
              label="Fecha Desde" type="date" fullWidth size="small" InputLabelProps={{ shrink: true }} 
              value={filtros.fechaDesde} onChange={(e) => setFiltros({ ...filtros, fechaDesde: e.target.value })} 
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4, md: 4 }}>
            <TextField 
              label="Fecha Hasta" type="date" fullWidth size="small" InputLabelProps={{ shrink: true }} 
              value={filtros.fechaHasta} onChange={(e) => setFiltros({ ...filtros, fechaHasta: e.target.value })} 
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4, md: 4 }}>
            <Button variant="contained" color="primary" fullWidth startIcon={<FilterAltIcon />} onClick={handleApplyFilters} sx={{ height: '40px' }}>
              Filtrar Rango
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>
      ) : llamadas.length === 0 ? (
        <Paper sx={{ p: 5, textAlign: 'center', borderRadius: 2 }}>
          <Typography color="text.secondary">No hay órdenes liquidadas en este rango.</Typography>
        </Paper>
      ) : isMobile ? (
        <Stack spacing={2}>
          {llamadas.map((llamada) => (
            <Card key={llamada.id} elevation={2} sx={{ borderRadius: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Checkbox size="small" sx={{ p: 0 }} checked={selectedIds.includes(llamada.id)} onChange={() => handleToggleSelect(llamada.id)} />
                    <Typography variant="subtitle1" fontWeight="bold" color="primary">OS #{llamada.id}</Typography>
                  </Box>
                  <Chip size="small" label="LIQUIDADA" color="primary" sx={{ fontWeight: 'bold' }} />
                </Box>
                <Typography variant="body2" color="text.secondary"><strong>Fecha:</strong> {llamada.fecha.split('T')[0]}</Typography>
                <Typography variant="body2" color="text.secondary"><strong>Cliente ID:</strong> {llamada.clienteId}</Typography>
                <Typography variant="body2" color="text.secondary"><strong>Equipo:</strong> {llamada.itemIncidenciaId}</Typography>
              </CardContent>
            </Card>
          ))}
        </Stack>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead sx={{ backgroundColor: 'action.hover' }}>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={selectedIds.length > 0 && selectedIds.length < llamadas.length}
                    checked={llamadas.length > 0 && selectedIds.length === llamadas.length}
                    onChange={handleSelectAll}
                  />
                </TableCell>
                <TableCell>Nro. OS</TableCell>
                <TableCell>Fecha</TableCell>
                <TableCell>Cliente ID</TableCell>
                <TableCell>Equipo</TableCell>
                <TableCell align="center">Estado</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {llamadas.map((llamada) => (
                <TableRow key={llamada.id} hover selected={selectedIds.includes(llamada.id)}>
                  <TableCell padding="checkbox">
                    <Checkbox checked={selectedIds.includes(llamada.id)} onChange={() => handleToggleSelect(llamada.id)} />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>#{llamada.id}</TableCell>
                  <TableCell>{llamada.fecha.split('T')[0]}</TableCell>
                  <TableCell>{llamada.clienteId}</TableCell>
                  <TableCell>{llamada.itemIncidenciaId}</TableCell>
                  <TableCell align="center">
                    <Chip size="small" label="LIQUIDADA" color="primary" sx={{ fontWeight: 'bold' }} />
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