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
interface TipoProblemaOption { id: string | number; nombre: string; }
interface TipoLlamadaOption { callTypeID: number; name: string; }
interface TecnicoOption { empID: number; name: string; }

const PRIORIDADES_BASE = ['REPARACION', 'MANTENIMIENTO'];
const PRIORIDADES_FT1 = [...PRIORIDADES_BASE, 'REPOSICION', 'NOTA DE CREDITO', 'NO CUBRE GARANTIA'];

const getLocalISOString = () => {
  const date = new Date();
  const tzoffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzoffset).toISOString().slice(0, -1) + 'Z';
};

export const LlamadaCreate = () => {
  const navigate = useNavigate();
  const user = useAppSelector(selectCurrentUser);
  const isFT1 = user?.ubicacion === '05-FT1';
  const prioridadOptions = isFT1 ? PRIORIDADES_FT1 : PRIORIDADES_BASE;

  const [formData, setFormData] = useState({
    nroFactura: '',
    lugarCompra: '',
    prioridad: 'REPARACION',
    origenLLSId: '',
    tipoProblemaSTId: '' as string | number,
    subtipoProblemaSTId: '' as string | number,
    tipoLLSId: '',
    tecnicoId: ''
  });

  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteOption | null>(null);
  const [itemSeleccionado, setItemSeleccionado] = useState<ItemOption | null>(null);
  const [motivoSeleccionado, setMotivoSeleccionado] = useState<MotivoOption | null>(null);

  const [origenes, setOrigenes] = useState<OrigenOption[]>([]);
  const [tiposLlamada, setTiposLlamada] = useState<TipoLlamadaOption[]>([]);
  const [tecnicos, setTecnicos] = useState<TecnicoOption[]>([]);

  // Clientes
  const [clientesOpciones, setClientesOpciones] = useState<ClienteOption[]>([]);
  const [isBuscandoClientes, setIsBuscandoClientes] = useState(false);

  const [itemsOpciones, setItemsOpciones] = useState<ItemOption[]>([]);
  const [isBuscandoItems, setIsBuscandoItems] = useState(false);

  // Motivos
  const [motivosIniciales, setMotivosIniciales] = useState<MotivoOption[]>([]);
  const [motivosOpciones, setMotivosOpciones] = useState<MotivoOption[]>([]);
  const [isBuscandoMotivos, setIsBuscandoMotivos] = useState(false);
  const [isNewMotivo, setIsNewMotivo] = useState(false);
  const [nuevoMotivoTexto, setNuevoMotivoTexto] = useState('');

  // Problemas y Sub-Problemas
  const [tiposProblema, setTiposProblema] = useState<TipoProblemaOption[]>([]);
  const [subtiposProblema, setSubtiposProblema] = useState<TipoProblemaOption[]>([]);
  const [isBuscandoProblemas, setIsBuscandoProblemas] = useState(false);
  const [isBuscandoSubproblemas, setIsBuscandoSubproblemas] = useState(false);
  const [isNewSubproblema, setIsNewSubproblema] = useState(false);
  const [nuevoSubproblemaNombre, setNuevoSubproblemaNombre] = useState('');

  // Modal Cliente
  const [modalClienteOpen, setModalClienteOpen] = useState(false);
  const [nuevoCliente, setNuevoCliente] = useState({ Code: '', Name: '', U_NA_DIRECCION: '', U_NA_TELEFONO: '', U_NA_CORREO: '' });
  const [isCreandoCliente, setIsCreandoCliente] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchCatalogosBasicos = async () => {
      try {
        const [resOrigenes, resTiposLlamada, resMotivos, resProblemas] = await Promise.all([
          api.get(TECH_ENDPOINTS.GET_ORIGENES_LLS),
          api.get(TECH_ENDPOINTS.GET_TIPOS_LLS),
          api.get(`${TECH_ENDPOINTS.GET_MOTIVOS}?top=30&skip=0`),
          api.get(TECH_ENDPOINTS.GET_TIPOS_PROBLEMA)
        ]);

        setOrigenes(resOrigenes.data.registros || []);
        setTiposLlamada(resTiposLlamada.data.registros || []);

        const motivosData = Array.isArray(resMotivos.data) ? resMotivos.data : (resMotivos.data.registros || []);
        setMotivosIniciales(motivosData);
        setMotivosOpciones(motivosData);
        const problemasData = Array.isArray(resProblemas.data) ? resProblemas.data : (resProblemas.data.registros || resProblemas.data.items || []);
        setTiposProblema(problemasData);
        setSubtiposProblema(problemasData);

        if (isFT1) {
          const resTecnicos = await api.get(TECH_ENDPOINTS.GET_TECNICOS_LLS);
          setTecnicos(resTecnicos.data.registros || []);
        }
      } catch (error) {
        console.error("Error al cargar catálogos básicos:", error);
        toast.error("Error al cargar algunos catálogos principales.");
      }
    };
    fetchCatalogosBasicos();
  }, [isFT1]);

  const subtiposFiltrados = subtiposProblema.filter(sp => String(sp.id) !== String(formData.tipoProblemaSTId));

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
      else if (data && data.Code) setClientesOpciones([data]);
      else setClientesOpciones([]);
    } catch (error) {
      console.error("Error al buscar clientes:", error);
    } finally {
      setIsBuscandoClientes(false);
    }
  };

  const buscarItemsSAP = async (query: string) => {
    if (query.length < 2) return;
    setIsBuscandoItems(true);
    try {
      const [resNombre, resId] = await Promise.allSettled([
        api.get(`${TECH_ENDPOINTS.SEARCH_SAP_ITEMS_NOMBRE}?nombre=${encodeURIComponent(query)}&top=20&skip=0`),
        api.get(TECH_ENDPOINTS.SEARCH_SAP_ITEMS_ID(query))
      ]);

      let porId: ItemOption[] = [];
      let porNombre: ItemOption[] = [];

      if (resId.status === 'fulfilled' && resId.value.data) {
        const data = resId.value.data.items || resId.value.data.registros || resId.value.data || [];
        porId = Array.isArray(data) ? data : [data];
      }

      if (resNombre.status === 'fulfilled' && resNombre.value.data) {
        const data = resNombre.value.data.items || resNombre.value.data.registros || resNombre.value.data || [];
        porNombre = Array.isArray(data) ? data : [data];
      }

      const combinados = [...porId, ...porNombre];
      const unicos = Array.from(new Map(combinados.map(item => [item.itemCode, item])).values());

      setItemsOpciones(unicos);
    } catch (error) {
      console.error("Error al buscar equipos:", error);
    } finally {
      setIsBuscandoItems(false);
    }
  };

  const buscarMotivos = async (query: string) => {
    if (query.length < 3) {
      setMotivosOpciones(motivosIniciales);
      return;
    }
    setIsBuscandoMotivos(true);
    try {
      const res = await api.get(`${TECH_ENDPOINTS.SEARCH_MOTIVOS_NOMBRE}?nombre=${encodeURIComponent(query)}`);
      setMotivosOpciones(Array.isArray(res.data) ? res.data : (res.data.registros || []));
    } catch (error) {
      console.error("Error al buscar motivos:", error);
    } finally {
      setIsBuscandoMotivos(false);
    }
  };

  const buscarProblemas = async (query: string, isSub: boolean) => {
    if (query.length < 3) {
      if (query.length === 0) {
        const url = TECH_ENDPOINTS.GET_TIPOS_PROBLEMA;
        const res = await api.get(url);
        const data = Array.isArray(res.data) ? res.data : (res.data.registros || res.data.items || []);
        if (isSub) setSubtiposProblema(data);
        else setTiposProblema(data);
      }
      return;
    }

    if (isSub) {
      setIsBuscandoSubproblemas(true);
    } else {
      setIsBuscandoProblemas(true);
    }

    try {
      const res = await api.get(`${TECH_ENDPOINTS.SEARCH_TIPOS_PROBLEMA_NOMBRE}?nombre=${encodeURIComponent(query)}`);
      const data = res.data.items || res.data.registros || res.data || [];
      if (isSub) {
        setSubtiposProblema(data);
      } else {
        setTiposProblema(data);
      }
    } catch (error) {
      console.error("Error al buscar clasificaciones de problemas:", error);
      toast.error("Ocurrió un error al buscar las clasificaciones.");
    } finally {
      if (isSub) {
        setIsBuscandoSubproblemas(false);
      } else {
        setIsBuscandoProblemas(false);
      }
    }
  };

  const handleCrearCliente = async () => {
    if (!nuevoCliente.Code || !nuevoCliente.Name) return toast.warning("La Identificación y el Nombre son obligatorios");
    setIsCreandoCliente(true);
    try {
      await api.post(TECH_ENDPOINTS.POST_CLIENTE, nuevoCliente);
      toast.success("Cliente creado exitosamente");
      setClienteSeleccionado({ Code: nuevoCliente.Code, Name: nuevoCliente.Name });
      setModalClienteOpen(false);
    } catch (error) {
      console.error("Error al crear cliente:", error);
      toast.error("Error al crear el cliente. Verifica los datos.");
    } finally {
      setIsCreandoCliente(false);
    }
  };

  const handleGuardarBorrador = async () => {
    if (!clienteSeleccionado) return toast.warning("Debes seleccionar un cliente");
    if (!itemSeleccionado) return toast.warning("Debes seleccionar el equipo afectado");
    if (!isNewMotivo && !motivoSeleccionado) return toast.warning("Debes seleccionar o crear un motivo");
    if (isNewMotivo && !nuevoMotivoTexto) return toast.warning("Escribe el nombre del nuevo motivo");
    if (!formData.origenLLSId || !formData.tipoLLSId) return toast.warning("El origen y tipo de llamada son obligatorios");
    if (isNewSubproblema && !nuevoSubproblemaNombre) return toast.warning("Escribe el nombre del nuevo Sub-Problema");

    setIsSubmitting(true);
    try {
      let motivoFinalId: string | number | undefined = motivoSeleccionado?.id;
      if (isNewMotivo) {
        const resMotivo = await api.post(TECH_ENDPOINTS.POST_MOTIVO, { nombre: nuevoMotivoTexto });
        const resData = resMotivo.data;
        motivoFinalId = (typeof resData === 'object' && resData !== null) ? resData.id : resData;
      }

      let subtipoFinalId: string | number = formData.subtipoProblemaSTId;
      if (isNewSubproblema) {
        const resSp = await api.post(TECH_ENDPOINTS.POST_TIPO_PROBLEMA, { nombre: nuevoSubproblemaNombre });
        subtipoFinalId = resSp.data.id || resSp.data;
      }

      const payload = {
        clienteSAPId: user?.codigocliente || "",
        proveedorSAPId: user?.codigoproveedor || "",
        fecha: getLocalISOString(),
        bodega: user?.idbranch || "",
        ubicacion: user?.ubicacion || "",
        origenLLSId: Number(formData.origenLLSId),
        tipoLLSId: Number(formData.tipoLLSId),
        clienteId: clienteSeleccionado.Code,
        itemIncidenciaId: itemSeleccionado.itemCode,
        motivoIncidenciaSTId: Number(motivoFinalId),
        tipoProblemaSTId: formData.tipoProblemaSTId,
        subtipoProblemaSTId: subtipoFinalId,
        tecnicoId: isFT1 && formData.tecnicoId ? Number(formData.tecnicoId) : null,
        nroFactura: formData.nroFactura,
        lugarCompra: formData.lugarCompra,
        prioridad: formData.prioridad,
        detalles: []
      };

      const res = await api.post(TECH_ENDPOINTS.POST_LLAMADA, payload);
      const resData = res.data;
      const nuevaLlamadaId = (typeof resData === 'object' && resData !== null && 'id' in resData) ? resData.id : resData;

      toast.success("Borrador de Orden de Servicio creado con éxito");
      navigate(`/tech/llamadas/${nuevaLlamadaId}/edit`);

    } catch (error: unknown) {
      console.error("Error al guardar borrador:", error);
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
              onInputChange={(_, newInputValue) => buscarItemsSAP(newInputValue)}
              onChange={(_, newValue) => setItemSeleccionado(newValue)}
              loading={isBuscandoItems}
              renderInput={(params) => (
                <TextField {...params} label="Buscar Equipo Afectado (Nombre o ID)" size="small"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (<React.Fragment>{isBuscandoItems ? <CircularProgress size={20} color="inherit" /> : null}{params.InputProps.endAdornment}</React.Fragment>),
                  }}
                />
              )}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="Nro. Factura (Manual)" fullWidth size="small" value={formData.nroFactura} onChange={(e) => setFormData({...formData, nroFactura: e.target.value})} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="Lugar de Compra (Manual)" fullWidth size="small" value={formData.lugarCompra} onChange={(e) => setFormData({...formData, lugarCompra: e.target.value})} />
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
            <TextField select label="Solución (Esperada)" fullWidth size="small" value={formData.prioridad} onChange={(e) => setFormData({...formData, prioridad: e.target.value})}>
              {prioridadOptions.map((prioridad) => (
                <MenuItem key={prioridad} value={prioridad}>{prioridad}</MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField select label="Origen" fullWidth size="small" value={formData.origenLLSId} onChange={(e) => setFormData({...formData, origenLLSId: e.target.value})}>
              {origenes.map(o => <MenuItem key={o.originID} value={o.originID}>{o.name}</MenuItem>)}
            </TextField>
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField select label="Tipo de Llamada" fullWidth size="small" value={formData.tipoLLSId} onChange={(e) => setFormData({...formData, tipoLLSId: e.target.value})}>
              {tiposLlamada.map(t => <MenuItem key={t.callTypeID} value={t.callTypeID}>{t.name}</MenuItem>)}
            </TextField>
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <Autocomplete
              options={tiposProblema}
              getOptionLabel={(opt) => typeof opt === 'string' ? opt : opt.nombre}
              isOptionEqualToValue={(option, value) => String(option.id) === String(value.id)}
              value={tiposProblema.find(tp => String(tp.id) === String(formData.tipoProblemaSTId)) || null}
              onInputChange={(_, val) => buscarProblemas(val, false)}
              onChange={(_, val) => {
                if (val && typeof val !== 'string') setFormData({ ...formData, tipoProblemaSTId: val.id, subtipoProblemaSTId: '' });
                else setFormData({ ...formData, tipoProblemaSTId: '', subtipoProblemaSTId: '' });
              }}
              loading={isBuscandoProblemas}
              renderInput={(params) => <TextField {...params} label="Buscar Problema Principal" size="small" />}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ flexGrow: 1 }}>
                {isNewSubproblema ? (
                  <TextField
                    fullWidth size="small" label="Nombre del Nuevo Sub-Problema"
                    value={nuevoSubproblemaNombre} onChange={(e) => setNuevoSubproblemaNombre(e.target.value)}
                  />
                ) : (
                  <Autocomplete
                    options={subtiposFiltrados}
                    getOptionLabel={(opt) => typeof opt === 'string' ? opt : opt.nombre}
                    isOptionEqualToValue={(option, value) => String(option.id) === String(value.id)}
                    value={subtiposFiltrados.find(sp => String(sp.id) === String(formData.subtipoProblemaSTId)) || null}
                    onInputChange={(_, val) => buscarProblemas(val, true)}
                    onChange={(_, val) => {
                      if (val && typeof val !== 'string') setFormData({ ...formData, subtipoProblemaSTId: val.id });
                      else setFormData({ ...formData, subtipoProblemaSTId: '' });
                    }}
                    loading={isBuscandoSubproblemas}
                    renderInput={(params) => <TextField {...params} label="Buscar Sub-Problema Existente" size="small" />}
                  />
                )}
              </Box>

              <FormControlLabel
                control={<Switch size="small" checked={isNewSubproblema} onChange={(e) => setIsNewSubproblema(e.target.checked)} color="primary" />}
                label={<Typography variant="caption" sx={{ whiteSpace: 'nowrap' }}>Crear Nuevo</Typography>}
                sx={{ m: 0, pt: 0.5 }}
              />
            </Box>
          </Grid>

          {isFT1 && (
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField select label="Técnico Asignado" fullWidth size="small" value={formData.tecnicoId} onChange={(e) => setFormData({...formData, tecnicoId: e.target.value})}>
                <MenuItem value=""><em>Sin Asignar</em></MenuItem>
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
