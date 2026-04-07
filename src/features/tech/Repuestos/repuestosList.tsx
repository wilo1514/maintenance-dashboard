import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, TextField, Grid, Button, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Chip, Card, CardContent,
  Stack, CircularProgress, useMediaQuery, Avatar
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import InventoryIcon from '@mui/icons-material/Inventory';

import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { selectCurrentUser } from '../../auth/authSlice';
import { 
  fetchRepuestos, clearRepuestos, selectAllRepuestos, selectRepuestosLoading 
} from './repuestosSlice'; // <-- Ajusta la ruta a tu slice

export const RepuestosList = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const dispatch = useAppDispatch();
  
  const user = useAppSelector(selectCurrentUser);
  const repuestos = useAppSelector(selectAllRepuestos);
  const isLoading = useAppSelector(selectRepuestosLoading);

  const [filtros, setFiltros] = useState({ codigo: '', nombre: '' });

  // Carga inicial (trae los primeros 50 ítems por defecto)
  useEffect(() => {
    if (user?.idbranch && user?.ubicacion) {
      dispatch(fetchRepuestos({ 
        whsCode: user.idbranch, 
        binLocation: user.ubicacion 
      }));
    }
    return () => { dispatch(clearRepuestos()); };
  }, [dispatch, user]);

  const handleSearch = () => {
    if (user?.idbranch && user?.ubicacion) {
      dispatch(fetchRepuestos({ 
        whsCode: user.idbranch, 
        binLocation: user.ubicacion,
        codigo: filtros.codigo,
        nombre: filtros.nombre
      }));
    }
  };

  const handleClear = () => {
    setFiltros({ codigo: '', nombre: '' });
    if (user?.idbranch && user?.ubicacion) {
      // Al limpiar, volvemos a cargar la lista por defecto
      dispatch(fetchRepuestos({ whsCode: user.idbranch, binLocation: user.ubicacion }));
    }
  };

  // Permite buscar al presionar "Enter" en los inputs
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
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

      {/* --- ZONA DE FILTROS --- */}
      <Paper sx={{ p: { xs: 2, md: 3 }, mb: 3, borderRadius: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField 
              label="Código (ID exacto)" fullWidth size="small" autoComplete="off"
              placeholder="Ej. VAS-001"
              value={filtros.codigo} 
              onChange={(e) => setFiltros({ ...filtros, codigo: e.target.value })}
              onKeyDown={handleKeyDown}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 5 }}>
            <TextField 
              label="Buscar por Nombre" fullWidth size="small" autoComplete="off"
              placeholder="Ej. VASO LICUADORA"
              value={filtros.nombre} 
              onChange={(e) => setFiltros({ ...filtros, nombre: e.target.value })}
              onKeyDown={handleKeyDown}
              disabled={filtros.codigo.length > 0} // Deshabilitamos si ya escribió un código
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 1.5 }}>
            <Button variant="contained" fullWidth startIcon={<SearchIcon />} onClick={handleSearch} sx={{ height: '40px' }}>
              Buscar
            </Button>
          </Grid>
          <Grid size={{ xs: 6, sm: 1.5 }}>
            <Button variant="outlined" color="inherit" fullWidth onClick={handleClear} sx={{ height: '40px' }}>
              <CleaningServicesIcon />
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
        // VISTA MÓVIL
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
        // VISTA ESCRITORIO
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