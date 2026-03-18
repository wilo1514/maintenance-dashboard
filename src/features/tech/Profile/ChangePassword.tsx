import React, { useState } from 'react';
import { 
  Box, Typography, Paper, TextField, Button, CircularProgress, 
  Container, Divider, InputAdornment, IconButton
} from '@mui/material';
import LockResetIcon from '@mui/icons-material/LockReset';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { toast } from 'sonner';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { selectCurrentUser, changeUserPassword } from '../../auth/authSlice';
import { useNavigate } from 'react-router-dom';

export const ChangePassword = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector(selectCurrentUser);

  // Estados de los valores
  const [passwordActual, setPasswordActual] = useState('');
  const [passwordNueva, setPasswordNueva] = useState('');
  const [passwordConfirmar, setPasswordConfirmar] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // --- NUEVO: Estados para mostrar/ocultar contraseñas ---
  const [showPasswordActual, setShowPasswordActual] = useState(false);
  const [showPasswordNueva, setShowPasswordNueva] = useState(false);
  const [showPasswordConfirmar, setShowPasswordConfirmar] = useState(false);

  // Validador de Seguridad
  const validatePassword = (pass: string) => {
    const regex = /^(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,}$/;
    return regex.test(pass);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.email) {
      return toast.error('Error: No se encontró el correo del usuario.');
    }
    if (passwordNueva !== passwordConfirmar) {
      return toast.error('Las contraseñas nuevas no coinciden.');
    }
    if (!validatePassword(passwordNueva)) {
      return toast.error('La contraseña nueva no cumple con los requisitos de seguridad.');
    }

    setIsLoading(true);
    try {
      await dispatch(changeUserPassword({
        emailUsuario: user.email, 
        passwordActual,
        passwordNueva
      })).unwrap();

      toast.success('Tu contraseña ha sido actualizada con éxito.');
      
      setPasswordActual('');
      setPasswordNueva('');
      setPasswordConfirmar('');
      
      navigate('/dashboard');

    } catch (error) {
      // Ahora el error se mostrará en español y clarito ("La contraseña actual ingresada es incorrecta.")
      toast.error(`${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: { xs: 2, sm: 4 }, px: { xs: 1, sm: 3 } }}>
      <Paper elevation={3} sx={{ p: { xs: 3, sm: 4 }, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
          <Box sx={{ p: 2, bgcolor: 'primary.light', borderRadius: '50%', mb: 2 }}>
            <LockResetIcon sx={{ fontSize: 40, color: 'primary.main' }} />
          </Box>
          <Typography variant="h5" fontWeight="bold" align="center">
            Cambiar mi Contraseña
          </Typography>
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 1 }}>
            Mantén tu cuenta segura actualizando tu clave periódicamente.
          </Typography>
        </Box>

        <Divider sx={{ mb: 3 }} />

        <Box component="form" onSubmit={handleSubmit} noValidate>
          
          {/* CONTRASEÑA ACTUAL */}
          <TextField
            fullWidth required 
            type={showPasswordActual ? 'text' : 'password'} 
            label="Contraseña Actual" margin="normal"
            value={passwordActual}
            onChange={(e) => setPasswordActual(e.target.value)}
            disabled={isLoading}
            autoComplete="current-password"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPasswordActual(!showPasswordActual)} edge="end" disabled={isLoading} tabIndex={-1}>
                    {showPasswordActual ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              )
            }}
          />

          {/* NUEVA CONTRASEÑA */}
          <TextField
            fullWidth required 
            type={showPasswordNueva ? 'text' : 'password'} 
            label="Nueva Contraseña" margin="normal"
            value={passwordNueva}
            onChange={(e) => setPasswordNueva(e.target.value)}
            disabled={isLoading}
            autoComplete="new-password"
            helperText="Mín. 8 caracteres, 1 mayúscula, 1 número y 1 especial (.,*@)"
            FormHelperTextProps={{ sx: { color: passwordNueva && !validatePassword(passwordNueva) ? 'error.main' : 'text.secondary' } }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPasswordNueva(!showPasswordNueva)} edge="end" disabled={isLoading} tabIndex={-1}>
                    {showPasswordNueva ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              )
            }}
          />

          {/* CONFIRMAR CONTRASEÑA */}
          <TextField
            fullWidth required 
            type={showPasswordConfirmar ? 'text' : 'password'} 
            label="Confirmar Nueva Contraseña" margin="normal"
            value={passwordConfirmar}
            onChange={(e) => setPasswordConfirmar(e.target.value)}
            disabled={isLoading}
            autoComplete="new-password"
            error={Boolean(passwordConfirmar && passwordNueva !== passwordConfirmar)}
            helperText={passwordConfirmar && passwordNueva !== passwordConfirmar ? "Las contraseñas no coinciden" : ""}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPasswordConfirmar(!showPasswordConfirmar)} edge="end" disabled={isLoading} tabIndex={-1}>
                    {showPasswordConfirmar ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              )
            }}
          />

          <Button
            type="submit" fullWidth variant="contained" size="large"
            disabled={isLoading || !passwordActual || !passwordNueva || !passwordConfirmar}
            sx={{ mt: 4, py: 1.5, borderRadius: 2 }}
          >
            {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Actualizar Contraseña'}
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};