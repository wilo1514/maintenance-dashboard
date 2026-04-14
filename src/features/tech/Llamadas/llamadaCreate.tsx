import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, TextField, Button, MenuItem, Switch,
  FormControlLabel, Autocomplete, CircularProgress, Dialog, DialogTitle,
  DialogContent, DialogActions, IconButton, Avatar, Divider
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import axios from 'axios';

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import PersonAddAltIcon from '@mui/icons-material/PersonAddAlt';
import BuildCircleIcon from '@mui/icons-material/BuildCircle';

import { useAppSelector } from '../../../app/hooks';
import { selectCurrentUser } from '../../auth/authSlice';
import api from '../../../services/api';
import { TECH_ENDPOINTS } from '../../../services/endpoints/tech';

interface ClienteOption { Code: string; Name: string; }
interface ItemOption { itemCode: string; itemName: string; }
interface MotivoOption { id: number | string; nombre: string; }
interface OrigenOption { originID: number; name: string; }
interface TipoProblemaOption { id: string; nombre: string; }
interface TipoLlamadaOption { callTypeID: number; name: string; }
interface TecnicoOption { empID: number; name: string; }

// 🚨 NUEVO HELPER: Obtiene la hora ISO exacta local (Ecuador)
const getLocalISOString = () => {
  const date = new Date();
  const tzoffset = date.getTimezoneOffset() * 60000; 
  return new Date(date.getTime() - tzoffset).toISOString().slice(0, -1) + 'Z'; 
};

export const LlamadaCreate = () => {
  const navigate = useNavigate();
  const user = useAppSelector(selectCurrentUser);
  const isFT1 = user?.ubicacion === '05-FT1';

  const [formData, setFormData] = useState({
    nroSerie: '',
    nroFabricante: '',
    prioridad: 'MEDIA',
    origenLLSId: '',
    tipoProblemaSTId: '',
    subtipoProblemaSTId: '',
    tipoLLSId: '',
    tecnicoId: ''
  });

  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteOption | null>(null);
  const [itemSeleccionado, setItemSeleccionado] = useState<ItemOption | null>(null);
  const [motivoSeleccionado, setMotivoSeleccionado] = useState<MotivoOption | null>(null);

  const [origenes, setOrigenes] = useState<OrigenOption[]>([]);
  const [tiposProblema, setTiposProblema] = useState<TipoProblemaOption[]>([]);
  const [subtiposProblema, setSubtiposProblema] = useState<TipoProblemaOption[]>([]);
  const [tiposLlamada, setTiposLlamada] = useState<TipoLlamadaOption[]>([]);
  const [tecnicos, setTecnicos] = useState<TecnicoOption[]>([]);

  const [clientesOpciones, setClientesOpciones] = useState<ClienteOption[]>([]);
  const [isBuscandoClientes, setIsBuscandoClientes] = useState(false);

  const [itemsOpciones, setItemsOpciones] = useState<ItemOption[]>([]);
  const [isBuscandoItems, setIsBuscandoItems] = useState(false);

  // 🚨 NUEVO ESTADO: Guarda los motivos base para mostrarlos cuando el input esté vacío
  const [motivosIniciales, setMotivosIniciales] = useState<MotivoOption[]>([]);
  const [motivosOpciones, setMotivosOpciones] = useState<MotivoOption[]>([]);
  const [isBuscandoMotivos, setIsBuscandoMotivos] = useState(false);

  const [isNewMotivo, setIsNewMotivo] = useState(false);
  const [nuevoMotivoTexto, setNuevoMotivoTexto] = useState('');

  const [modalClienteOpen, setModalClienteOpen] = useState(false);
  const [nuevoCliente, setNuevoCliente] = useState({ Code: '', Name: '', U_NA_DIRECCION: '', U_NA_TELEFONO: '', U_NA_CORREO: '' });
  const [isCreandoCliente, setIsCreandoCliente] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. CARGA BÁSICA DE CATÁLOGOS (Y MOTIVOS INICIALES)
  useEffect(() => {
    const fetchCatalogosBasicos = async () => {
      try {
        const [resOrigenes, resTiposLlamada, resMotivos] = await Promise.all([
          api.get(TECH_ENDPOINTS.GET_ORIGENES_LLS),
          api.get(TECH_ENDPOINTS.GET_TIPOS_LLS),
          api.get('/motivos-incidencia-st?top=30&skip=0') // 🚨 Carga inicial de motivos sugeridos
        ]);
        
        setOrigenes(resOrigenes.data.registros || []);
        setTiposLlamada(resTiposLlamada.data.registros || []);

        // Extraer motivos iniciales soportando arrays directos o dentro de "registros"
        const motivosData = Array.isArray(resMotivos.data) ? resMotivos.data : (resMotivos.data.registros || []);
        setMotivosIniciales(motivosData);
        setMotivosOpciones(motivosData); // Llenamos las opciones con las sugerencias

        if (isFT1) {
          const resTecnicos = await api.get(TECH_ENDPOINTS.GET_TECNICOS_LLS);
          setTecnicos(resTecnicos.data.registros || []);
        }
      } catch (error) {
        toast.error("Error al cargar algunos catálogos"+ error);
      }
    };
    fetchCatalogosBasicos();
  }, [isFT1]);

  // 2. CASCADA: ORIGEN -> TIPO PROBLEMA Y SUBTIPO PROBLEMA
  useEffect(() => {
    if (formData.origenLLSId) {
      Promise.all([
        api.get(TECH_ENDPOINTS.GET_TIPOS_PROBLEMA_CATEGORIA(formData.origenLLSId)),
        api.get(TECH_ENDPOINTS.GET_SUBTIPOS_PROBLEMA_CATEGORIA(formData.origenLLSId))
      ])
      .then(([resTipos, resSubtipos]) => {
        setTiposProblema(resTipos.data || []);
        setSubtiposProblema(resSubtipos.data || []);
      })
      .catch(() => toast.error("Error al cargar Tipos/Subtipos de Problema"));

      setFormData(prev => ({ ...prev, tipoProblemaSTId: '', subtipoProblemaSTId: '' }));
    } else {
      setTiposProblema([]);
      setSubtiposProblema([]);
      setFormData(prev => ({ ...prev, tipoProblemaSTId: '', subtipoProblemaSTId: '' }));
    }
  }, [formData.origenLLSId]);

  // 🚨 REGLA DE EXCLUSIÓN MUTUA
  const subtiposFiltrados = subtiposProblema.filter(sp => sp.id !== formData.tipoProblemaSTId);

  // --- BÚSQUEDAS (AUTOCOMPLETES) ---
  const buscarClientes = async (query: string) => {
    if (query.length < 3) return;
    setIsBuscandoClientes(true);
    try {
      const isNumeric = /^\d+$/.test(query);
      
      const url = isNumeric 
        ? TECH_ENDPOINTS.SEARCH_CLIENTES_DOCUMENTO(query)
        : `${TECH_ENDPOINTS.SEARCH_CLIENTES_NOMBRE}?nombre=${encodeURIComponent(query)}&top=20&skip=0`;
      
      const res = await api.get(url);
      const data = res.data;

      if (data.clientes) setClientesOpciones(data.clientes);
      else if (Array.isArray(data)) setClientesOpciones(data);
      else if (data && data.Code) setClientesOpciones([data]); // Si es por ID exacto
      else setClientesOpciones([]);

    } catch (e) { console.error(e); } finally { setIsBuscandoClientes(false); }
  };

  const buscarItems = async (query: string) => {
    if (query.length < 3) return;
    setIsBuscandoItems(true);
    try {
      const res = await api.get(`${TECH_ENDPOINTS.SEARCH_SAP_ITEMS_NOMBRE}?nombre=${encodeURIComponent(query)}&top=20&skip=0`);
      const data = res.data;

      // RED DE SEGURIDAD
      if (data.items) setItemsOpciones(data.items);
      else if (Array.isArray(data)) setItemsOpciones(data);
      else if (data && data.itemCode) setItemsOpciones([data]);
      else setItemsOpciones([]);

    } catch (e) { console.error(e); } finally { setIsBuscandoItems(false); }
  };

  const buscarMotivos = async (query: string) => {
    // 🚨 LÓGICA DE FALLBACK: Si borra o escribe menos de 3 letras, regresa la lista inicial
    if (query.length < 3) {
      setMotivosOpciones(motivosIniciales);
      return;
    }

    setIsBuscandoMotivos(true);
    try {
      const res = await api.get(`${TECH_ENDPOINTS.SEARCH_MOTIVOS_NOMBRE}?nombre=${encodeURIComponent(query)}`);
      setMotivosOpciones(Array.isArray(res.data) ? res.data : (res.data.registros || []));
    } catch (e) { 
      console.error(e); 
    } finally { 
      setIsBuscandoMotivos(false); 
    }
  };

  // --- CREAR CLIENTE ---
  const handleCrearCliente = async () => {
    if (!nuevoCliente.Code || !nuevoCliente.Name) return toast.warning("La Identificación y el Nombre son obligatorios");
    setIsCreandoCliente(true);
    try {
      await api.post(TECH_ENDPOINTS.POST_CLIENTE, nuevoCliente);
      toast.success("Cliente creado exitosamente");
      setClienteSeleccionado({ Code: nuevoCliente.Code, Name: nuevoCliente.Name });
      setModalClienteOpen(false);
    } catch (error) {
      toast.error("Error al crear el cliente. Verifica los datos.");
      console.error(error);
    } finally {
      setIsCreandoCliente(false);
    }
  };

  // --- GUARDAR BORRADOR ---
  const handleGuardarBorrador = async () => {
    if (!clienteSeleccionado) return toast.warning("Debes seleccionar un cliente");
    if (!itemSeleccionado) return toast.warning("Debes seleccionar el equipo afectado");
    if (!isNewMotivo && !motivoSeleccionado) return toast.warning("Debes seleccionar o crear un motivo");
    if (isNewMotivo && !nuevoMotivoTexto) return toast.warning("Escribe el nombre del nuevo motivo");
    if (!formData.origenLLSId || !formData.tipoLLSId) return toast.warning("El origen y tipo de llamada son obligatorios");

    setIsSubmitting(true);
    try {
      let motivoFinalId: string | number | undefined = motivoSeleccionado?.id;

      if (isNewMotivo) {
        const resMotivo = await api.post<{ id?: number | string } | number | string>(TECH_ENDPOINTS.POST_MOTIVO, { nombre: nuevoMotivoTexto });
        const resData = resMotivo.data;
        if (typeof resData === 'object' && resData !== null) {
          motivoFinalId = resData.id;
        } else {
          motivoFinalId = resData;
        }
      }

      const payload = {
        clienteSAPId: user?.codigocliente || "",
        proveedorSAPId: user?.codigoproveedor || "",
        fecha: getLocalISOString(), // Usando hora local Ecuador
        bodega: user?.idbranch || "",
        ubicacion: user?.ubicacion || "",
        origenLLSId: Number(formData.origenLLSId),
        tipoLLSId: Number(formData.tipoLLSId),
        clienteId: clienteSeleccionado.Code,
        itemIncidenciaId: itemSeleccionado.itemCode,
        motivoIncidenciaSTId: Number(motivoFinalId),
        tipoProblemaSTId: formData.tipoProblemaSTId,
        subtipoProblemaSTId: formData.subtipoProblemaSTId,
        tecnicoId: isFT1 ? Number(formData.tecnicoId) : null,
        nroSerie: formData.nroSerie,
        nroFabricante: formData.nroFabricante,
        prioridad: formData.prioridad,
        detalles: []
      };

      const res = await api.post(TECH_ENDPOINTS.POST_LLAMADA, payload);
      const resData = res.data;
      const nuevaLlamadaId = (typeof resData === 'object' && resData !== null && 'id' in resData) ? resData.id : resData;

      toast.success("Borrador de Orden de Servicio creado con éxito");
      navigate(`/tech/llamadas/${nuevaLlamadaId}/edit`);

    } catch (error: unknown) {
      if (axios.isAxiosError(error)) toast.error(error.response?.data?.message || "Ocurrió un error al crear la orden");
      else toast.error("Error desconocido al crear la orden");
      setIsSubmitting(false);
    }
  };

  return (
    <Box sx={{ pb: { xs: 10, md: 4 }, maxWidth: 1000, margin: '0 auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={() => navigate(-1)} sx={{ mr: 1, backgroundColor: 'background.paper', boxShadow: 1 }}>
          <ArrowBackIcon />
        </IconButton>
        <Avatar sx={{ bgcolor: 'secondary.main', mr: 2 }}><BuildCircleIcon /></Avatar>
        <Typography variant="h5" sx={{ fontWeight: 'bold' }}>Crear Orden de Servicio</Typography>
      </Box>

      <Paper sx={{ p: { xs: 2, md: 4 }, borderRadius: 2, mb: 3 }}>
        <Grid container spacing={3}>
          
          <Grid size={{ xs: 12 }}>
            <Typography variant="subtitle1" fontWeight="bold" color="primary">1. Datos del Cliente y Equipo</Typography>
            <Divider sx={{ mb: 2 }} />
          </Grid>

          <Grid size={{ xs: 12, sm: 8 }}>
            <Autocomplete
              options={clientesOpciones}
              getOptionLabel={(option) => `${option.Code} - ${option.Name}`}
              onInputChange={(_, newInputValue) => buscarClientes(newInputValue)}
              onChange={(_, newValue) => setClienteSeleccionado(newValue)}
              loading={isBuscandoClientes}
              renderInput={(params) => (
                <TextField {...params} label="Buscar Cliente (Nombre o RUC/Cédula)" size="small"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <React.Fragment>
                        {isBuscandoClientes ? <CircularProgress color="inherit" size={20} /> : null}
                        {params.InputProps.endAdornment}
                      </React.Fragment>
                    ),
                  }}
                />
              )}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Button fullWidth variant="outlined" startIcon={<PersonAddAltIcon />} onClick={() => setModalClienteOpen(true)} sx={{ height: '40px' }}>
              Crear Nuevo Cliente
            </Button>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Autocomplete
              options={itemsOpciones}
              getOptionLabel={(option) => `${option.itemCode} - ${option.itemName}`}
              onInputChange={(_, newInputValue) => buscarItems(newInputValue)}
              onChange={(_, newValue) => setItemSeleccionado(newValue)}
              loading={isBuscandoItems}
              renderInput={(params) => (
                <TextField {...params} label="Buscar Equipo Afectado (Nombre o Código)" size="small"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (<React.Fragment>{isBuscandoItems ? <CircularProgress size={20} /> : null}{params.InputProps.endAdornment}</React.Fragment>),
                  }}
                />
              )}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="Nro. Serie (Manual)" fullWidth size="small" value={formData.nroSerie} onChange={(e) => setFormData({...formData, nroSerie: e.target.value})} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="Nro. Fabricante (Manual)" fullWidth size="small" value={formData.nroFabricante} onChange={(e) => setFormData({...formData, nroFabricante: e.target.value})} />
          </Grid>

          <Grid size={{ xs: 12 }} sx={{ mt: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold" color="primary">2. Motivo de la Llamada (Asunto)</Typography>
            <Divider sx={{ mb: 2 }} />
          </Grid>

          <Grid size={{ xs: 12, sm: 8 }}>
            {isNewMotivo ? (
              <TextField 
                label="Escribe el Nuevo Motivo" fullWidth size="small" autoFocus
                value={nuevoMotivoTexto} onChange={(e) => setNuevoMotivoTexto(e.target.value)} 
              />
            ) : (
              <Autocomplete
                options={motivosOpciones}
                getOptionLabel={(option) => option.nombre}
                onInputChange={(_, newInputValue) => buscarMotivos(newInputValue)}
                onChange={(_, newValue) => setMotivoSeleccionado(newValue)}
                loading={isBuscandoMotivos}
                renderInput={(params) => <TextField {...params} label="Seleccionar Motivo o Buscar" size="small" />}
              />
            )}
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }} sx={{ display: 'flex', alignItems: 'center' }}>
            <FormControlLabel
              control={<Switch checked={isNewMotivo} onChange={(e) => setIsNewMotivo(e.target.checked)} color="primary" />}
              label="Crear Nuevo Motivo"
            />
          </Grid>

          <Grid size={{ xs: 12 }} sx={{ mt: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold" color="primary">3. Clasificación y Asignación</Typography>
            <Divider sx={{ mb: 2 }} />
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField select label="Origen" fullWidth size="small" value={formData.origenLLSId} onChange={(e) => setFormData({...formData, origenLLSId: e.target.value})}>
              {origenes.map(o => <MenuItem key={o.originID} value={o.originID}>{o.name}</MenuItem>)}
            </TextField>
          </Grid>
          
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField select label="Tipo Problema" fullWidth size="small" disabled={!formData.origenLLSId} value={formData.tipoProblemaSTId} onChange={(e) => setFormData({...formData, tipoProblemaSTId: e.target.value, subtipoProblemaSTId: ''})}>
              {tiposProblema.map(tp => <MenuItem key={tp.id} value={tp.id}>{tp.nombre}</MenuItem>)}
            </TextField>
          </Grid>
          
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField select label="Subtipo Problema" fullWidth size="small" disabled={!formData.origenLLSId} value={formData.subtipoProblemaSTId} onChange={(e) => setFormData({...formData, subtipoProblemaSTId: e.target.value})}>
              {subtiposFiltrados.map(stp => <MenuItem key={stp.id} value={stp.id}>{stp.nombre}</MenuItem>)}
            </TextField>
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField select label="Tipo de Llamada" fullWidth size="small" value={formData.tipoLLSId} onChange={(e) => setFormData({...formData, tipoLLSId: e.target.value})}>
              {tiposLlamada.map(t => <MenuItem key={t.callTypeID} value={t.callTypeID}>{t.name}</MenuItem>)}
            </TextField>
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField select label="Prioridad" fullWidth size="small" value={formData.prioridad} onChange={(e) => setFormData({...formData, prioridad: e.target.value})}>
              <MenuItem value="ALTA">Alta</MenuItem>
              <MenuItem value="MEDIA">Media</MenuItem>
              <MenuItem value="BAJA">Baja</MenuItem>
            </TextField>
          </Grid>

          {isFT1 && (
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField select label="Técnico Asignado" fullWidth size="small" value={formData.tecnicoId} onChange={(e) => setFormData({...formData, tecnicoId: e.target.value})}>
                {tecnicos.map(t => <MenuItem key={t.empID} value={t.empID}>{t.name}</MenuItem>)}
              </TextField>
            </Grid>
          )}

        </Grid>

        <Box sx={{ mt: 5, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
          <Button variant="outlined" color="inherit" onClick={() => navigate(-1)} disabled={isSubmitting}>Cancelar</Button>
          <Button variant="contained" color="primary" startIcon={isSubmitting ? <CircularProgress size={20} color="inherit"/> : <SaveIcon />} onClick={handleGuardarBorrador} disabled={isSubmitting}>
            Guardar Borrador
          </Button>
        </Box>
      </Paper>

      {/* MODAL CREAR CLIENTE */}
      <Dialog open={modalClienteOpen} onClose={() => setModalClienteOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>Crear Nuevo Cliente</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12 }}>
              <TextField label="Identificación (RUC/Cédula)" fullWidth size="small" value={nuevoCliente.Code} onChange={(e) => setNuevoCliente({...nuevoCliente, Code: e.target.value})} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField label="Nombre Completo" fullWidth size="small" value={nuevoCliente.Name} onChange={(e) => setNuevoCliente({...nuevoCliente, Name: e.target.value})} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField label="Dirección" fullWidth size="small" value={nuevoCliente.U_NA_DIRECCION} onChange={(e) => setNuevoCliente({...nuevoCliente, U_NA_DIRECCION: e.target.value})} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Teléfono" fullWidth size="small" value={nuevoCliente.U_NA_TELEFONO} onChange={(e) => setNuevoCliente({...nuevoCliente, U_NA_TELEFONO: e.target.value})} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Correo" type="email" fullWidth size="small" value={nuevoCliente.U_NA_CORREO} onChange={(e) => setNuevoCliente({...nuevoCliente, U_NA_CORREO: e.target.value})} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setModalClienteOpen(false)} color="inherit" disabled={isCreandoCliente}>Cancelar</Button>
          <Button onClick={handleCrearCliente} variant="contained" color="success" disabled={isCreandoCliente}>
            {isCreandoCliente ? "Guardando..." : "Crear Cliente"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};