//обмеження на клієнті лише зручність інтерфейсу; справжній захист (RBAC) на сервері

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import ForbiddenPage from '../pages/ForbiddenPage.jsx';
import { LoadingState } from './RequestState.jsx';

export function RequireAuth() {
  const { status, isAuthenticated } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <LoadingState />;
  if (!isAuthenticated) return <Navigate to="/welcome" replace state={{ from: location }} />;
  return <Outlet />;
}

export function RequireAdmin() {
  const { status, isAuthenticated, isAdmin } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <LoadingState />;
  if (!isAuthenticated) return <Navigate to="/welcome" replace state={{ from: location }} />;
  if (!isAdmin) return <ForbiddenPage />;
  return <Outlet />;
}

//після входу веде на сторінку, з якої користувача перенаправили на вхід, або на головну
export function GuestOnly() {
  const { status, isAuthenticated } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <LoadingState />;
  if (isAuthenticated) {
    const from = location.state?.from;
    const target = from ? `${from.pathname}${from.search ?? ''}` : '/';
    return <Navigate to={target} replace />;
  }
  return <Outlet />;
}
