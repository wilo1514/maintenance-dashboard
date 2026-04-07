import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, TextField, Grid, Button, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Chip, Card, CardContent,
  Stack, CircularProgress, useMediaQuery, Avatar
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import InventoryIcon from '@mui/icons-material/Inventory';

import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { selectCurrentUser } from '../../auth/authSlice';
import { 
  fetchRepuestos, clearRepuestos, selectAllRepuestos, selectRepuestosLoading 
} from './repuestosSlice'; 

export const RepuestosList = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const dispatch = useAppDispatch();
  
  const user = useAppSelector(selectCurrentUser);
  const repuestos = useAppSelector(selectAllRepuestos);
  const isLoading = useAppSelector(selectRepuestosLoading);

  const [filtros, setFiltros] = useState({ codigo: '', nombre: '' });
  // Estado intermedio para el "Debounce" (esperar a que termine de escribir)
  const [debouncedFiltros, setDebouncedFiltros] = useState(filtros);

  // 1. Efecto Debounce: Actualiza los filtros reales 500ms después de que el usuario deja de escribir
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFiltros(filtros);
    }, 500);
    return () => clearTimeout(timer);
  }, [filtros]);

  // 2. Efecto de Búsqueda Automática: Reacciona cuando los filtros debounced cambian
  useEffect(() => {
    if (!user?.idbranch || !user?.ubicacion) return;

    const { codigo, nombre } = debouncedFiltros;
    
    // Regla: Buscar si hay código, o si el nombre tiene 3 o más letras
    if (codigo.trim().length > 0 || nombre.trim().length >= 3) {
      dispatch(fetchRepuestos({ 
        whsCode: user.idbranch, 
        binLocation: user.ubicacion,
        codigo: codigo,
        nombre: nombre
      }));
    } 
    // Regla: Si ambos campos están vacíos (Carga inicial o tras limpiar)
    else if (codigo === '' && nombre === '') {
      dispatch(fetchRepuestos({ 
        whsCode: user.idbranch, 
        binLocation: user.ubicacion 
      }));
    }

    // Limpieza al desmontar el componente
    return () => { dispatch(clearRepuestos()); };
  }, [debouncedFiltros, dispatch, user]);

  const handleClear = () => {
    setFiltros({ codigo: '', nombre: '' });
  };

  return (
    <Box sx={{ pb: { xs: 10, md: 4 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Avatar sx={{ bgcolor: 'primary.main' }}>
          <InventoryIcon />
        </Avatar>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 'bold' }}>Inventario de Repuestos</Typography>
          <Typography variant="body2" color="text.secondary">
            Stock actual en: <strong>{user?.ubicacion}</strong> (Bodega {user?.idbranch})
          </Typography>
        </Box>
      </Box>

      {/* --- ZONA DE FILTROS AUTOMÁTICOS --- */}
      <Paper sx={{ p: { xs: 2, md: 3 }, mb: 3, borderRadius: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField 
              label="Código (Búsqueda inmediata)" fullWidth size="small" autoComplete="off"
              placeholder="Ej. VAS-001"
              value={filtros.codigo} 
              onChange={(e) => setFiltros({ ...filtros, codigo: e.target.value })}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 5 }}>
            <TextField 
              label="Nombre (Mínimo 3 letras)" fullWidth size="small" autoComplete="off"
              placeholder="Ej. VASO LICUADORA"
              value={filtros.nombre} 
              onChange={(e) => setFiltros({ ...filtros, nombre: e.target.value })}
              disabled={filtros.codigo.length > 0} 
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            {/* BOTÓN VERDE DE LIMPIAR */}
            <Button 
              variant="contained" 
              color="success" 
              fullWidth 
              onClick={handleClear} 
              sx={{ height: '40px', fontWeight: 'bold' }}
            >
              Limpiar
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* --- LISTADO DE RESULTADOS --- */}
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 10 }}>
          <CircularProgress />
        </Box>
      ) : repuestos.length === 0 ? (
        <Paper sx={{ p: 5, textAlign: 'center', borderRadius: 2 }}>
          <Typography variant="h6" color="text.secondary">No se encontraron repuestos.</Typography>
          <Typography variant="body2" color="text.secondary">Intenta ajustando los filtros de búsqueda.</Typography>
        </Paper>
      ) : isMobile ? (
        <Stack spacing={2}>
          {repuestos.map((item, index) => (
            <Card key={index} elevation={2} sx={{ borderRadius: 2, borderLeft: '4px solid', borderColor: item.onHandQty > 0 ? 'success.main' : 'error.main' }}>
              <CardContent sx={{ pb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                  <Typography variant="subtitle2" color="primary" fontWeight="bold">{item.itemCode}</Typography>
                  <Chip 
                    size="small" 
                    label={`Stock: ${item.onHandQty}`} 
                    color={item.onHandQty > 0 ? "success" : "error"} 
                    sx={{ fontWeight: 'bold' }} 
                  />
                </Box>
                <Typography variant="body2" color="text.primary">{item.itemName}</Typography>
              </CardContent>
            </Card>
          ))}
        </Stack>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead sx={{ backgroundColor: 'action.hover' }}>
              <TableRow>
                <TableCell>Código de Repuesto</TableCell>
                <TableCell>Descripción</TableCell>
                <TableCell align="right">Stock Disponible</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {repuestos.map((item, index) => (
                <TableRow key={index} hover>
                  <TableCell sx={{ fontWeight: 'bold', color: 'primary.main', width: '20%' }}>{item.itemCode}</TableCell>
                  <TableCell>{item.itemName}</TableCell>
                  <TableCell align="right" sx={{ width: '15%' }}>
                    <Chip 
                      label={item.onHandQty} 
                      color={item.onHandQty > 0 ? "success" : "error"} 
                      size="small" 
                      sx={{ fontWeight: 'bold', minWidth: '50px' }} 
                    />
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