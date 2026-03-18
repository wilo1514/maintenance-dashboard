import React, { useState } from 'react';
import {
  Box, Button, Container, TextField, Typography, Paper, CssBaseline, CircularProgress,
  InputAdornment, IconButton
} from '@mui/material';
// IMPORTAMOS LOS OJITOS
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';

import { toast } from 'sonner'; 
import logoUmco from '../../assets/logoumco.png';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { loginUser, selectAuthLoading } from './authSlice'; 
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const isLoading = useAppSelector(selectAuthLoading);

  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  
  // NUEVO ESTADO PARA EL OJITO
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (userName && password) {
      try {
        await dispatch(loginUser({ userName, password })).unwrap();
        toast.success('¡Bienvenido al sistema!');
        navigate('/dashboard'); 
      }  catch (err) {
        let mensajeError = 'Credenciales incorrectas';

        if (typeof err === 'string') {
          mensajeError = err; 
        } else if (err instanceof Error) {
          mensajeError = err.message; 
        } 

        toast.error(mensajeError);
      }
  }};

  return (
    <Container component="main" maxWidth="xs">
      <CssBaseline />
      <Box sx={{ marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Paper elevation={3} sx={{ padding: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', borderRadius: 2 }}>
          <Box component="img" sx={{ height: 'auto', width: '80%', maxWidth: 200, marginBottom: 3 }} alt="Logo UMCO" src={logoUmco} />
          
          <Typography component="h1" variant="h5" sx={{ mb: 3, fontWeight: 600 }}>
            Ingreso al Sistema
          </Typography>

          <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1, width: '100%' }}>
            
            <TextField 
              margin="normal" required fullWidth autoFocus 
              id="userName" label="Usuario" name="userName" 
              value={userName} onChange={(e) => setUserName(e.target.value)} 
              disabled={isLoading} 
            />
            
            {/* CAMPO DE CONTRASEÑA ACTUALIZADO CON EL OJITO */}
            <TextField 
              margin="normal" required fullWidth 
              name="password" label="Contraseña" id="password" 
              type={showPassword ? 'text' : 'password'} 
              autoComplete="current-password" 
              value={password} onChange={(e) => setPassword(e.target.value)} 
              disabled={isLoading} 
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      disabled={isLoading}
                      tabIndex={-1} // Para que no estorbe al navegar con la tecla Tab
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
            
            <Button 
              type="submit" fullWidth variant="contained" 
              disabled={isLoading || !userName || !password} 
              sx={{ mt: 3, mb: 2, py: 1.5, fontSize: '1rem' }}
            >
              {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Iniciar Sesión'}
            </Button>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default Login;