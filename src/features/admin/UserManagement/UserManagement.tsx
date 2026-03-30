import React, { useState, useEffect } from 'react';
import {
  Box, Button, Typography, Paper, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, IconButton, Dialog, 
  DialogTitle, DialogContent, DialogActions, TextField, 
  Chip, Grid, useMediaQuery, Card, CardContent, 
  CardActions, Stack, Divider, Tooltip, InputAdornment, MenuItem
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import EditIcon from '@mui/icons-material/Edit';
import BlockIcon from '@mui/icons-material/Block'; 
import KeyIcon from '@mui/icons-material/VpnKey';
import AddIcon from '@mui/icons-material/Add';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'; 
import PersonOffIcon from '@mui/icons-material/PersonOff'; 
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';

import { toast } from 'sonner';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { 
  selectAllUsers, selectUsersLoading, fetchUsers, 
  createUser, updateUser, resetUserPassword, 
  makeAdmin, removeAdmin, fetchBodegas, fetchUbicaciones, 
  selectBodegas, selectUbicaciones, selectSapLoading, clearUbicaciones, type SystemUser 
} from '../usersSlice';

export const UserManagement = () => {
  const dispatch = useAppDispatch();
  
  const users = useAppSelector(selectAllUsers);
  const isLoading = useAppSelector(selectUsersLoading);
  const bodegas = useAppSelector(selectBodegas);
  const ubicaciones = useAppSelector(selectUbicaciones);
  const isSapLoading = useAppSelector(selectSapLoading);
  
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md')); 

  useEffect(() => {
    dispatch(fetchUsers());
    dispatch(fetchBodegas()); 
  }, [dispatch]);

  // --- NUEVO ESTADO DE FILTRO PARA UBICACIÓN ---
  const [filterCodigo, setFilterCodigo] = useState('');
  const [filterName, setFilterName] = useState('');
  const [filterUbicacion, setFilterUbicacion] = useState('');

  // --- FILTRO ACTUALIZADO ---
  const filteredUsers = users.filter(user => 
    (user.codigo || '').toLowerCase().includes(filterCodigo.toLowerCase()) &&
    (user.name || '').toLowerCase().includes(filterName.toLowerCase()) &&
    (user.ubicacion || '').toLowerCase().includes(filterUbicacion.toLowerCase())
  );

  const [open, setOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [isDowngrading, setIsDowngrading] = useState(false); 
  
  const [formData, setFormData] = useState({ 
    codigo: '', name: '', email: '', password: '', 
    bodegaCode: '', ubicacionCode: '' 
  });

  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [userForPassword, setUserForPassword] = useState<SystemUser | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const handleOpen = (user?: SystemUser, downgrading = false) => {
    setIsDowngrading(downgrading); 
    
    if (user) {
      setEditingUser(user);
      setFormData({ 
        codigo: user.codigo, 
        name: user.name, 
        email: user.email, 
        password: '', 
        bodegaCode: user.idBranch || '', 
        ubicacionCode: user.ubicacion || '' 
      });
      if (user.idBranch) {
        dispatch(fetchUbicaciones(user.idBranch));
      } else {
        dispatch(clearUbicaciones());
      }
    } else {
      setEditingUser(null);
      setFormData({ codigo: '', name: '', email: '', password: '', bodegaCode: '', ubicacionCode: '' });
      dispatch(clearUbicaciones()); 
      setShowPassword(false); 
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setIsDowngrading(false);
  };

  const handleBodegaChange = (whsCode: string) => {
    setFormData({ ...formData, bodegaCode: whsCode, ubicacionCode: '' });
    if (whsCode) {
      dispatch(fetchUbicaciones(whsCode));
    } else {
      dispatch(clearUbicaciones());
    }
  };

  const validatePassword = (pass: string) => {
    const regex = /^(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,}$/;
    return regex.test(pass);
  };

  const handleSave = async () => {
    try {
      if (!formData.bodegaCode || !formData.ubicacionCode) {
        return toast.error('Debes seleccionar una Bodega y una Ubicación.');
      }

      const codigoClienteGenerado = `${formData.ubicacionCode}-C`;
      const codigoProveedorGenerado = `${formData.ubicacionCode}-P`;

      if (editingUser) {
        const updatePayload = {
          emailActual: editingUser.email, 
          nuevoEmail: formData.email,     
          nuevoUserName: formData.codigo, 
          userNameComplete: formData.name,
          ubicacion: formData.ubicacionCode,
          codigoCliente: codigoClienteGenerado,
          codigoProveedor: codigoProveedorGenerado,
          idBranch: formData.bodegaCode
        };

        await dispatch(updateUser(updatePayload)).unwrap();

        if (isDowngrading) {
          await dispatch(removeAdmin(editingUser.email)).unwrap();
          toast.success('Permisos actualizados y convertido a Técnico exitosamente.');
        } else {
          toast.success('Usuario actualizado con éxito');
        }

      } else {
        if (!validatePassword(formData.password)) {
          return toast.error('La contraseña debe tener mín. 8 caracteres, 1 mayúscula, 1 número y 1 carácter especial (Ej: .,*@)');
        }

        const createPayload = {
          userName: formData.codigo,
          userNameComplete: formData.name,
          email: formData.email,
          password: formData.password,
          idBranch: formData.bodegaCode,
          ubicacion: formData.ubicacionCode,
          codigoCliente: codigoClienteGenerado,
          codigoProveedor: codigoProveedorGenerado,
          rol: 'servtecnico' as const 
        };

        await dispatch(createUser(createPayload)).unwrap();
        toast.success('Usuario creado con éxito');
      }
      
      handleClose(); 
    } catch (error) {
      toast.error(`${error}`);
    }
  };

  const handleToggleAdmin = async (user: SystemUser) => {
    try {
      if (user.role === 'admin') {
        handleOpen(user, true); 
        toast.info('Para cambiar a Técnico, por favor asígnale una Bodega y Ubicación.');
      } else {
        await dispatch(makeAdmin(user.email)).unwrap();
        toast.success(`${user.name} ahora es Administrador.`);
      }
    } catch (error) {
      toast.error(`Error al cambiar permisos: ${error}`);
    }
  };

  const handleDelete = (id: string) => {
    toast.info('Función de Inhabilitar Usuario en construcción por el backend.');
  };

  const handleSaveNewPassword = async (e?: React.MouseEvent | React.FormEvent) => {
    if (e) e.preventDefault(); 
    if (userForPassword) {
      if (!validatePassword(newPassword)) return toast.error('La contraseña debe tener mín. 8 caracteres, 1 mayúscula, 1 número y 1 carácter especial.');
      try {
        await dispatch(resetUserPassword({ emailUsuario: userForPassword.email, passwordNueva: newPassword })).unwrap();
        toast.success(`Contraseña actualizada con éxito.`);
        setPasswordModalOpen(false);
      } catch (error) { 
        toast.error(`${error}`); 
      }
    }
  };

  const handleOpenPasswordModal = (user: SystemUser) => {
    setUserForPassword(user);
    setNewPassword('');
    setShowNewPassword(false);
    setPasswordModalOpen(true);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 2, mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 'bold' }}>Gestión de Usuarios</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()} sx={{ width: { xs: '100%', sm: 'auto' } }}>Nuevo Usuario</Button>
      </Box>

      {/* --- CAJA DE FILTROS ACTUALIZADA A 3 COLUMNAS --- */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField fullWidth size="small" label="Filtrar por Código" value={filterCodigo} onChange={(e) => setFilterCodigo(e.target.value)} autoComplete="off" />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField fullWidth size="small" label="Filtrar por Nombre" value={filterName} onChange={(e) => setFilterName(e.target.value)} autoComplete="off" />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField fullWidth size="small" label="Filtrar por Ubicación" value={filterUbicacion} onChange={(e) => setFilterUbicacion(e.target.value)} autoComplete="off" />
          </Grid>
        </Grid>
      </Paper>

      {isMobile ? (
        <Stack spacing={2} sx={{ mb: 3 }}>
          {isLoading && filteredUsers.length === 0 ? (
            <Typography align="center" sx={{ py: 3 }}>Cargando usuarios...</Typography>
          ) : filteredUsers.length === 0 ? (
            <Typography align="center" color="textSecondary" sx={{ py: 3 }}>No hay usuarios que coincidan con la búsqueda.</Typography>
          ) : (
            filteredUsers.map((user) => (
              <Card key={user.id} elevation={3} sx={{ borderRadius: 2, borderLeft: user.role === 'admin' ? '4px solid #d32f2f' : '4px solid #1976d2' }}>
                <CardContent sx={{ pb: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 'bold', lineHeight: 1.2, pr: 1 }}>{user.name}</Typography>
                    <Chip size="small" color={user.role === 'admin' ? 'error' : 'primary'} label={user.role === 'admin' ? 'Admin' : 'Técnico'} />
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}><strong>Código:</strong> {user.codigo}</Typography>
                  {/* NUEVO: DATO DE UBICACIÓN EN MÓVIL */}
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}><strong>Ubicación:</strong> {user.ubicacion || 'N/A'}</Typography>
                  <Typography variant="body2" color="text.secondary"><strong>Email:</strong> {user.email}</Typography>
                </CardContent>
                <Divider />
                <CardActions sx={{ justifyContent: 'flex-end', pt: 0.5, pb: 0.5 }}>
                  <Tooltip title={user.role === 'admin' ? "Quitar Admin" : "Hacer Admin"}>
                    <IconButton color={user.role === 'admin' ? "warning" : "success"} onClick={() => handleToggleAdmin(user)}>
                      {user.role === 'admin' ? <PersonOffIcon /> : <AdminPanelSettingsIcon />}
                    </IconButton>
                  </Tooltip>
                  <IconButton color="info" onClick={() => handleOpenPasswordModal(user)}><KeyIcon /></IconButton>
                  <IconButton color="primary" onClick={() => handleOpen(user)}><EditIcon /></IconButton>
                  <IconButton color="default" onClick={() => handleDelete(user.id)}><BlockIcon /></IconButton>
                </CardActions>
              </Card>
            ))
          )}
        </Stack>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Código</TableCell>
                <TableCell>Nombre</TableCell>
                <TableCell>Ubicación</TableCell> {/* NUEVA COLUMNA */}
                <TableCell>Email</TableCell>
                <TableCell>Rol</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && filteredUsers.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 3 }}>Cargando usuarios...</TableCell></TableRow>
              ) : filteredUsers.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 3 }}>No hay usuarios que coincidan con la búsqueda.</TableCell></TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell><strong>{user.codigo}</strong></TableCell>
                    <TableCell>{user.name}</TableCell>
                    {/* NUEVO: DATO DE UBICACIÓN EN PC */}
                    <TableCell>
                      {user.ubicacion ? <Chip size="small" label={user.ubicacion} variant="outlined" /> : <Typography variant="caption" color="text.secondary">N/A</Typography>}
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Chip size="small" color={user.role === 'admin' ? 'error' : 'primary'} label={user.role === 'admin' ? 'Administrador' : 'Servicio Técnico'} />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title={user.role === 'admin' ? "Quitar permisos de Admin" : "Otorgar permisos de Admin"}>
                        <IconButton color={user.role === 'admin' ? "warning" : "success"} onClick={() => handleToggleAdmin(user)}>
                          {user.role === 'admin' ? <PersonOffIcon /> : <AdminPanelSettingsIcon />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Cambiar Contraseña">
                        <IconButton color="info" onClick={() => handleOpenPasswordModal(user)}><KeyIcon /></IconButton>
                      </Tooltip>
                      <Tooltip title="Editar Datos">
                        <IconButton color="primary" onClick={() => handleOpen(user)}><EditIcon /></IconButton>
                      </Tooltip>
                      <Tooltip title="Inhabilitar">
                        <IconButton color="default" onClick={() => handleDelete(user.id)}><BlockIcon /></IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* MODAL CREAR / EDITAR */}
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          {isDowngrading ? 'Asignar Sucursal (Cambio a Técnico)' : (editingUser ? 'Editar Usuario' : 'Crear Usuario')}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid size={{ xs: 12 }}>
              <TextField
                label="Código de Usuario (userName)" fullWidth required
                value={formData.codigo} 
                onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                disabled={!!editingUser}
                helperText={!editingUser ? "Ingresa código." : "El código no es modificable."}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField label="Nombre Completo" fullWidth required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField label="Correo Electrónico" fullWidth required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
            </Grid>

            {/* SECCIÓN DE BODEGA: VISIBLE SIEMPRE */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField 
                select fullWidth required label="Bodega Asignada"
                value={formData.bodegaCode}
                onChange={(e) => handleBodegaChange(e.target.value)}
                InputLabelProps={{ htmlFor: 'bodega-select' }} SelectProps={{ inputProps: { id: 'bodega-select' } }}
              >
                {bodegas.map((b) => (
                  <MenuItem key={b.whsCode} value={b.whsCode}>{b.whsName}</MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField 
                select fullWidth required label="Ubicación Específica"
                value={formData.ubicacionCode}
                onChange={(e) => setFormData({ ...formData, ubicacionCode: e.target.value })}
                disabled={!formData.bodegaCode || isSapLoading}
                InputLabelProps={{ htmlFor: 'ubi-select' }} SelectProps={{ inputProps: { id: 'ubi-select' } }}
                helperText={isSapLoading ? "Cargando..." : ""}
              >
                {ubicaciones.map((u) => (
                  <MenuItem key={u.absEntry} value={u.binCode}>{u.binCode}</MenuItem>
                ))}
              </TextField>
            </Grid>

            {/* CONTRASEÑA SOLO AL CREAR */}
            {!editingUser && (
              <Grid size={{ xs: 12 }}>
                <TextField 
                  label="Contraseña Inicial" 
                  type={showPassword ? 'text' : 'password'} 
                  fullWidth required 
                  value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} 
                  helperText="Mín. 8 caracteres, 1 mayúscula, 1 número y 1 especial (.,*@)"
                  autoComplete="new-password" 
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" tabIndex={-1}>
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={handleClose}>Cancelar</Button>
          <Button 
            onClick={handleSave} variant="contained" 
            disabled={!formData.codigo || !formData.name || !formData.email || !formData.bodegaCode || !formData.ubicacionCode || (!editingUser && !formData.password)}
          >
            Guardar
          </Button>
        </DialogActions>
      </Dialog>

      {/* MODAL DE CONTRASEÑA */}
      <Dialog open={passwordModalOpen} onClose={() => setPasswordModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Cambiar Contraseña</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2, mt: 1 }}>Ingresa la nueva contraseña para <strong>{userForPassword?.name}</strong>.</Typography>
          <TextField 
            margin="dense" label="Nueva Contraseña" 
            type={showNewPassword ? 'text' : 'password'} 
            fullWidth autoFocus 
            value={newPassword} onChange={(e) => setNewPassword(e.target.value)} 
            helperText="Mín. 8 caracteres, 1 mayúscula, 1 número y 1 especial (.,*@)"
            autoComplete="new-password" 
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowNewPassword(!showNewPassword)} edge="end" tabIndex={-1}>
                    {showNewPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              )
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={() => setPasswordModalOpen(false)}>Cancelar</Button>
          <Button type="button" onClick={(e) => handleSaveNewPassword(e)} variant="contained" color="warning" disabled={!newPassword}>
            Actualizar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};