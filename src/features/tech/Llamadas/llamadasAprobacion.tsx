import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, Chip, IconButton, CircularProgress, Dialog, 
  DialogTitle, DialogContent, DialogActions, Avatar, Button, TextField
} from '@mui/material';
import { toast } from 'sonner';

import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import VisibilityIcon from '@mui/icons-material/Visibility';

import api from '../../../services/api';
import { TECH_ENDPOINTS } from '../../../services/endpoints/tech';
import { type LlamadaServicio } from './llamadasSlice';
import { useAppSelector } from '../../../app/hooks';
import { selectCurrentUser } from '../../auth/authSlice';
import { useNavigate } from 'react-router-dom';

export const LlamadasAprobacion = () => {
  const navigate = useNavigate();
  const user = useAppSelector(selectCurrentUser);
  
  const [llamadas, setLlamadas] = useState<LlamadaServicio[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Estados para Modal de Autorización
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [selectedOsId, setSelectedOsId] = useState<number | null>(null);

  // Estados para Modal de Negación
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [comentariosNegacion, setComentariosNegacion] = useState('');

  const cargarAprobaciones = async () => {
    setIsLoading(true);
    try {
      // 🚨 Añadida la paginación al endpoint
      const res = await api.get<LlamadaServicio[]>(`${TECH_ENDPOINTS.GET_LLAMADAS}?pagina=1&recordsPorPagina=50&estado=P`);
      const filtradas = res.data.filter(os => os.detalles && os.detalles.length > 0);
      setLlamadas(filtradas.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()));
    } catch (error) {
      console.error(error);
      toast.error("Error al cargar la bandeja de aprobaciones");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Seguridad: Si no es 05-FT1, lo sacamos de aquí
    if (user?.ubicacion !== '05-FT1') {
      toast.error("No tienes permisos para ver esta bandeja");
      navigate('/tech/llamadas');
      return;
    }
    cargarAprobaciones();
  }, [user, navigate]);

  // --- LÓGICA DE APROBACIÓN ---
  const openAuthModal = (id: number) => {
    setSelectedOsId(id);
    setAuthModalOpen(true);
  };

  const handleAutorizar = async () => {
    if (!selectedOsId) return;
    try {
      await api.patch(TECH_ENDPOINTS.PATCH_LLAMADA_ESTADO(selectedOsId), { estado: 'A' });
      // Aquí iría el PUT a SAP en el futuro
      toast.success(`Orden #${selectedOsId} Autorizada correctamente`);
      setLlamadas(llamadas.filter(ll => ll.id !== selectedOsId)); // La quitamos de la bandeja
    } catch (error) {
      console.error(error);
      toast.error("Error al autorizar la orden");
    } finally {
      setAuthModalOpen(false);
      setSelectedOsId(null);
    }
  };

  // --- LÓGICA DE NEGACIÓN ---
  const openRejectModal = (id: number) => {
    setSelectedOsId(id);
    setComentariosNegacion('');
    setRejectModalOpen(true);
  };

  const handleNegar = async () => {
    if (!selectedOsId) return;
    try {
      await api.patch(TECH_ENDPOINTS.PATCH_LLAMADA_ESTADO(selectedOsId), { estado: 'N' });
      toast.info(`Orden #${selectedOsId} ha sido Denegada (N)`);
      setLlamadas(llamadas.filter(ll => ll.id !== selectedOsId));
    } catch (error) {
      console.error(error);
      toast.error("Error al denegar la orden");
    } finally {
      setRejectModalOpen(false);
      setSelectedOsId(null);
    }
  };

  return (
    <Box sx={{ pb: 4, maxWidth: 1200, margin: '0 auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
        <Avatar sx={{ bgcolor: 'warning.main', width: 56, height: 56 }}><FactCheckIcon fontSize="large" /></Avatar>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 'bold' }}>Bandeja de Autorizaciones</Typography>
          <Typography variant="body2" color="text.secondary">Órdenes pendientes de revisión central (05-FT1)</Typography>
        </Box>
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 10 }}><CircularProgress /></Box>
      ) : llamadas.length === 0 ? (
        <Paper sx={{ p: 5, textAlign: 'center', borderRadius: 2 }}>
          <Typography variant="h6" color="text.secondary">¡Excelente trabajo!</Typography>
          <Typography color="text.secondary">No hay órdenes pendientes de autorización en este momento.</Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead sx={{ backgroundColor: 'action.hover' }}>
              <TableRow>
                <TableCell>Nro. OS</TableCell>
                <TableCell>Origen (Bodega)</TableCell>
                <TableCell>Fecha</TableCell>
                <TableCell>Cliente</TableCell>
                <TableCell align="center">Ítems Solicitados</TableCell>
                <TableCell align="center">Decisión</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {llamadas.map((llamada) => (
                <TableRow key={llamada.id} hover>
                  <TableCell sx={{ fontWeight: 'bold' }}>#{llamada.id}</TableCell>
                  <TableCell><Chip label={llamada.ubicacion} size="small" variant="outlined" /></TableCell>
                  <TableCell>{llamada.fecha.split('T')[0]}</TableCell>
                  <TableCell>{llamada.clienteId}</TableCell>
                  <TableCell align="center">
                    <Chip label={`${llamada.detalles?.length || 0} detalles`} color="info" size="small" />
                  </TableCell>
                  <TableCell align="center">
                    <IconButton color="info" title="Revisar Detalles" onClick={() => navigate(`/tech/llamadas/${llamada.id}/edit`)}>
                      <VisibilityIcon />
                    </IconButton>
                    <IconButton color="success" title="Autorizar" onClick={() => openAuthModal(llamada.id)}>
                      <CheckCircleIcon />
                    </IconButton>
                    <IconButton color="error" title="Negar" onClick={() => openRejectModal(llamada.id)}>
                      <CancelIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* --- MODAL DE AUTORIZACIÓN --- */}
      <Dialog open={authModalOpen} onClose={() => setAuthModalOpen(false)}>
        <DialogTitle sx={{ fontWeight: 'bold', color: 'success.main', display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckCircleIcon /> Confirmar Autorización
        </DialogTitle>
        <DialogContent dividers>
          <Typography>¿Está seguro de autorizar la Orden de Servicio <strong>#{selectedOsId}</strong>?</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Esta acción cambiará el estado a Autorizada (A) y notificará al técnico de origen.</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setAuthModalOpen(false)} color="inherit">Cancelar</Button>
          <Button onClick={handleAutorizar} variant="contained" color="success">Autorizar Orden</Button>
        </DialogActions>
      </Dialog>

      {/* --- MODAL DE NEGACIÓN --- */}
      <Dialog open={rejectModalOpen} onClose={() => setRejectModalOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 'bold', color: 'error.main', display: 'flex', alignItems: 'center', gap: 1 }}>
          <CancelIcon /> Negar Orden de Servicio
        </DialogTitle>
        <DialogContent dividers>
          <Typography sx={{ mb: 2 }}>¿Está seguro de denegar la Orden <strong>#{selectedOsId}</strong>? Esta acción es irreversible y bloqueará la edición para el técnico.</Typography>
          <TextField 
            label="Comentarios de rechazo (Opcional)" 
            fullWidth 
            multiline 
            rows={3} 
            value={comentariosNegacion} 
            onChange={(e) => setComentariosNegacion(e.target.value)} 
            placeholder="Ej. Falta adjuntar la factura del equipo..."
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setRejectModalOpen(false)} color="inherit">Cancelar</Button>
          <Button onClick={handleNegar} variant="contained" color="error">Denegar Orden</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};