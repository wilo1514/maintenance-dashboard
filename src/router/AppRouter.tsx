import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { MainLayout } from '../components/layout/MainLayout';
import { Typography } from '@mui/material';
import Login from '../features/auth/Login'; 
import { useAppSelector } from '../app/hooks';
import { selectIsAuthenticated, selectCurrentUser } from '../features/auth/authSlice';

// Importaciones de tus pantallas
import { UserManagement } from '../features/admin/UserManagement/UserManagement';
import { ChangePassword } from '../features/tech/Profile/ChangePassword'; // NUEVA PANTALLA
import { TransferList } from '../features/tech/transferList';
import { TransferItems } from '../features/tech/Transfers/TransferItems';
import { TransferCreate } from '../features/tech/Transfers/TransferCreate';
import { RepuestosList } from '../features/tech/Repuestos/repuestosList';

const DashboardPlaceholder = () => <Typography variant="h4">Bienvenido al Dashboard</Typography>;

// 1. GUARDIA GENERAL (Solo verifica si estás logueado)
const ProtectedRoute = () => {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
};

// 2. GUARDIA DE ROLES (Verifica si tu rol tiene permiso para esta pantalla)
const RoleProtectedRoute = ({ allowedRoles }: { allowedRoles: string[] }) => {
  const user = useAppSelector(selectCurrentUser);
  // Si no hay usuario o su rol no está en la lista de permitidos, lo mandamos al dashboard
  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Outlet />;
};

const PublicRoute = () => {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
};

export const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicRoute />}><Route path="/login" element={<Login />} /></Route>

        {/* RUTAS PROTEGIDAS GENERALES */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPlaceholder />} />
            
            {/* ========================================== */}
            {/* ZONA EXCLUSIVA PARA ADMINISTRADORES */}
            {/* ========================================== */}
            <Route element={<RoleProtectedRoute allowedRoles={['admin']} />}>
              <Route path="admin/users" element={<UserManagement />} />
            </Route>
            
            {/* ========================================== */}
            {/* ZONA EXCLUSIVA PARA SERVICIO TÉCNICO */}
            {/* ========================================== */}
            <Route element={<RoleProtectedRoute allowedRoles={['servtecnico']} />}>

              <Route path="tech/transfers" element={<TransferList />} /> 
              <Route path="/tech/transfers/new" element={<TransferCreate />} />
              <Route path="/tech/transfers/edit/:id" element={<TransferCreate />} />
              <Route path="/tech/transfers/:id/items" element={<TransferItems />} />
              <Route path="/tech/repuestos" element={<RepuestosList/>}/>

              <Route path="tech/change-password" element={<ChangePassword />} /> 
            </Route>

          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
};