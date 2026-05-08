import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { MainLayout } from '../components/layout/MainLayout';
import Login from '../features/auth/Login'; 
import { useAppSelector } from '../app/hooks';
import { selectIsAuthenticated, selectCurrentUser } from '../features/auth/authSlice';

// Importaciones
import { Dashboard } from '../features/dashboard/Dashboard';
import { UserManagement } from '../features/admin/UserManagement/UserManagement';
import { ChangePassword } from '../features/tech/Profile/ChangePassword'; 
import { TransferList } from '../features/tech/transferList';
import { TransferItems } from '../features/tech/Transfers/TransferItems';
import { TransferCreate } from '../features/tech/Transfers/TransferCreate';
import { RepuestosList } from '../features/tech/Repuestos/repuestosList';
import { LlamadasList } from '../features/tech/Llamadas/llamadasLista';
import { LlamadasServiciosList } from '../features/tech/Llamadas/llamadasServiciosList';
import { LlamadaCreate } from '../features/tech/Llamadas/llamadaCreate';
import { LlamadaEdit } from '../features/tech/Llamadas/llamadaEdit';
import { LlamadasAprobacion } from '../features/tech/Llamadas/llamadasAprobacion';


import { OrdenesCompraList } from '../features/tech/Ordenes/ordenesCompraList';
import { OrdenCompraEdit } from '../features/tech/Ordenes/ordenCompraEdit';

import { TiposProblemaList } from '../features/tech/Llamadas/tiposProblemaList';

const ProtectedRoute = () => {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
};

const RoleProtectedRoute = ({ allowedRoles }: { allowedRoles: string[] }) => {
  const user = useAppSelector(selectCurrentUser);
  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Outlet />;
};

const FT1ProtectedRoute = () => {
  const user = useAppSelector(selectCurrentUser);
  if (user?.ubicacion !== '05-FT1') {
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

        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            
            <Route element={<RoleProtectedRoute allowedRoles={['admin']} />}>
              <Route path="admin/users" element={<UserManagement />} />
            </Route>
            
            <Route element={<RoleProtectedRoute allowedRoles={['servtecnico']} />}>
              <Route path="tech/transfers" element={<TransferList />} /> 
              <Route path="tech/transfers/new" element={<TransferCreate />} />
              <Route path="tech/transfers/edit/:id" element={<TransferCreate />} />
              <Route path="tech/transfers/:id/items" element={<TransferItems />} />
              <Route path="tech/repuestos" element={<RepuestosList/>}/>
              <Route path="tech/change-password" element={<ChangePassword />} /> 
              <Route path="tech/llamadas" element={<LlamadasList/> }/>
              <Route path="tech/llamadas/new" element={<LlamadaCreate />} />
              <Route path="tech/llamadas/:id/edit" element={<LlamadaEdit />} />
              <Route element={<FT1ProtectedRoute />}>
                <Route path="tech/llamadas/aprobaciones" element={<LlamadasAprobacion />} />
                <Route path="tech/llamadas/negadas" element={<Navigate to="/tech/llamadas/servicios" replace />} />
                <Route path="tech/llamadas/servicios" element={<LlamadasServiciosList />} />
                <Route path="tech/tipos-problema" element={<TiposProblemaList />} />
              </Route>

              
              <Route path="tech/ordenes-compra" element={<OrdenesCompraList />} />
              <Route path="tech/ordenes-compra/:id/edit" element={<OrdenCompraEdit />} />
            </Route>

          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
};
