import { useEffect, useMemo, useState } from 'react';
import {
  Avatar, Box, Button, Card, CardContent, Chip, CircularProgress, Grid,
  LinearProgress, Paper, Stack, Typography
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import BuildIcon from '@mui/icons-material/Build';
import InventoryIcon from '@mui/icons-material/Inventory';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import ArticleIcon from '@mui/icons-material/Article';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

import api from '../../services/api';
import { ADMIN_ENDPOINTS } from '../../services/endpoints/admin';
import { TECH_ENDPOINTS } from '../../services/endpoints/tech';
import { useAppSelector } from '../../app/hooks';
import { selectCurrentUser } from '../auth/authSlice';

interface DashboardMetric {
  label: string;
  value: number;
  color: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
}

const estadosOS = [
  { code: 'P', label: 'Pendientes', color: 'warning' as const },
  { code: 'A', label: 'Autorizadas', color: 'info' as const },
  { code: 'T', label: 'Abiertas', color: 'success' as const },
  { code: 'S', label: 'Stock Pendiente', color: 'error' as const },
  { code: 'C', label: 'Cerradas', color: 'secondary' as const },
  { code: 'N', label: 'Negadas', color: 'primary' as const },
];

const extractCount = (rawData: unknown, fallbackLength = 0) => {
  if (!rawData || typeof rawData !== 'object') return fallbackLength;
  const data = rawData as { count?: unknown; total?: unknown; totalItems?: unknown; totalRegistros?: unknown; items?: unknown[]; registros?: unknown[]; data?: unknown[] };
  const value = data.count ?? data.total ?? data.totalItems ?? data.totalRegistros;
  if (typeof value === 'number') return value;
  if (Array.isArray(data.items)) return data.items.length;
  if (Array.isArray(data.registros)) return data.registros.length;
  if (Array.isArray(data.data)) return data.data.length;
  return fallbackLength;
};

const getOneMonthAgoDate = () => {
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  return date.toISOString().split('T')[0];
};

const MetricCard = ({ metric }: { metric: DashboardMetric }) => (
  <Card elevation={1} sx={{ height: '100%', borderRadius: 2 }}>
    <CardContent>
      <Stack direction="row" spacing={2} alignItems="center">
        <Avatar sx={{ bgcolor: `${metric.color}.main` }}><TrendingUpIcon /></Avatar>
        <Box>
          <Typography variant="body2" color="text.secondary">{metric.label}</Typography>
          <Typography variant="h4" fontWeight="bold">{metric.value}</Typography>
        </Box>
      </Stack>
    </CardContent>
  </Card>
);

const BarList = ({ metrics }: { metrics: DashboardMetric[] }) => {
  const maxValue = Math.max(...metrics.map((metric) => metric.value), 1);
  return (
    <Stack spacing={2}>
      {metrics.map((metric) => (
        <Box key={metric.label}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
            <Typography variant="body2" fontWeight={600}>{metric.label}</Typography>
            <Chip size="small" label={metric.value} color={metric.color} variant="outlined" />
          </Stack>
          <LinearProgress
            variant="determinate"
            value={(metric.value / maxValue) * 100}
            color={metric.color}
            sx={{ height: 10, borderRadius: 999 }}
          />
        </Box>
      ))}
    </Stack>
  );
};

export const Dashboard = () => {
  const navigate = useNavigate();
  const user = useAppSelector(selectCurrentUser);
  const [isLoading, setIsLoading] = useState(false);
  const [adminUsers, setAdminUsers] = useState(0);
  const [osMetrics, setOsMetrics] = useState<DashboardMetric[]>([]);
  const [repuestosDisponibles, setRepuestosDisponibles] = useState(0);

  const isAdmin = user?.role === 'admin';
  const isTech = user?.role === 'servtecnico';
  const isFT1 = user?.ubicacion === '05-FT1';

  useEffect(() => {
    const cargarDashboard = async () => {
      if (!user) return;
      setIsLoading(true);
      try {
        if (isAdmin) {
          const res = await api.get<unknown>(ADMIN_ENDPOINTS.GET_USERS);
          setAdminUsers(Array.isArray(res.data) ? res.data.length : extractCount(res.data));
        }

        if (isTech) {
          const fechaDesde = getOneMonthAgoDate();
          const statusCounts = await Promise.all(
            estadosOS.map(async (estado) => {
              const params = new URLSearchParams({
                estado: estado.code,
                fechaDesde,
                pagina: '1',
                recordsPorPagina: '1',
              });
              if (user.idbranch) params.append('bodega', user.idbranch);
              if (user.ubicacion) params.append('ubicacion', user.ubicacion);

              const res = await api.get<unknown>(`${TECH_ENDPOINTS.GET_LLAMADAS}?${params.toString()}`);
              return { label: estado.label, value: extractCount(res.data), color: estado.color };
            })
          );
          setOsMetrics(statusCounts);

          if (user.idbranch && user.ubicacion) {
            const params = new URLSearchParams({
              top: '1',
              skip: '0',
              whsCode: user.idbranch,
              binLocation: user.ubicacion,
            });
            const res = await api.get<unknown>(`${TECH_ENDPOINTS.GET_SAP_REPUESTOS}?${params.toString()}`);
            setRepuestosDisponibles(extractCount(res.data));
          }
        }
      } catch (error) {
        console.error('Error cargando dashboard', error);
      } finally {
        setIsLoading(false);
      }
    };

    cargarDashboard();
  }, [isAdmin, isTech, user]);

  const totalOS = useMemo(() => osMetrics.reduce((total, metric) => total + metric.value, 0), [osMetrics]);

  if (isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress /></Box>;
  }

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">Dashboard</Typography>
        <Typography variant="body2" color="text.secondary">
          {isFT1 ? 'Panel central 05-FT1' : user?.ubicacion ? `Servicio técnico ${user.ubicacion}` : 'Resumen general'}
        </Typography>
      </Box>

      {isAdmin && (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 4 }}>
            <MetricCard metric={{ label: 'Usuarios registrados', value: adminUsers, color: 'primary' }} />
          </Grid>
          <Grid size={{ xs: 12, md: 8 }}>
            <Paper sx={{ p: 3, borderRadius: 2 }}>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>Usuarios del sistema</Typography>
              <BarList metrics={[{ label: 'Total usuarios', value: adminUsers, color: 'primary' }]} />
            </Paper>
          </Grid>
        </Grid>
      )}

      {isTech && (
        <Grid container spacing={3}>
          {isFT1 && (
            <Grid size={{ xs: 12 }}>
              <Paper sx={{ p: 3, borderRadius: 2 }}>
                <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>Accesos de autorización</Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <Button variant="contained" startIcon={<FactCheckIcon />} onClick={() => navigate('/tech/llamadas/aprobaciones')}>
                    Órdenes de Servicio por Autorizar
                  </Button>
                  <Button variant="outlined" startIcon={<ArticleIcon />} onClick={() => navigate('/tech/ordenes-compra')}>
                    Órdenes de Compra por Autorizar
                  </Button>
                </Stack>
              </Paper>
            </Grid>
          )}

          <Grid size={{ xs: 12, md: 4 }}>
            <MetricCard metric={{ label: 'OS del periodo', value: totalOS, color: 'info' }} />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <MetricCard metric={{ label: 'Repuestos disponibles', value: repuestosDisponibles, color: 'success' }} />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card elevation={1} sx={{ height: '100%', borderRadius: 2 }}>
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Avatar sx={{ bgcolor: 'warning.main' }}><BuildIcon /></Avatar>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Servicio técnico</Typography>
                    <Typography variant="h5" fontWeight="bold">{user?.ubicacion || 'Sin ubicación'}</Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 7 }}>
            <Paper sx={{ p: 3, borderRadius: 2 }}>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>Órdenes de servicio por estado</Typography>
              <BarList metrics={osMetrics} />
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, md: 5 }}>
            <Paper sx={{ p: 3, borderRadius: 2, height: '100%' }}>
              <Stack spacing={2} alignItems="center" justifyContent="center" sx={{ minHeight: 220 }}>
                <Avatar sx={{ bgcolor: 'success.main', width: 72, height: 72 }}><InventoryIcon fontSize="large" /></Avatar>
                <Typography variant="h3" fontWeight="bold">{repuestosDisponibles}</Typography>
                <Typography variant="body1" color="text.secondary" textAlign="center">
                  Repuestos disponibles en {user?.ubicacion || 'el servicio técnico'}
                </Typography>
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};
