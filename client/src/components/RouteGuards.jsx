/**
 * @module components/RouteGuards
 * @description Обмеження доступу до маршрутів на клієнті (RBAC). Це лише зручність інтерфейсу:
 * справжній захист — на сервері (authenticate, requireRole('admin')).
 */

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import ForbiddenPage from '../pages/ForbiddenPage.jsx';
import { LoadingState } from './RequestState.jsx';

/**
 * Пропускає лише авторизованих; гостя перенаправляє на сторінку привітання.
 * @returns {JSX.Element} вкладений маршрут, індикатор або редірект.
 */
export function RequireAuth() {
  const { status, isAuthenticated } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <LoadingState />;
  if (!isAuthenticated) return <Navigate to="/welcome" replace state={{ from: location }} />;
  return <Outlet />;
}

/**
 * Пропускає лише адміністратора; гостя веде на сторінку привітання,
 * звичайному користувачу показує сторінку «Доступ заборонено».
 * @returns {JSX.Element} вкладений маршрут, індикатор, редірект або сторінка 403.
 */
export function RequireAdmin() {
  const { status, isAuthenticated, isAdmin } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <LoadingState />;
  if (!isAuthenticated) return <Navigate to="/welcome" replace state={{ from: location }} />;
  if (!isAdmin) return <ForbiddenPage />;
  return <Outlet />;
}

/**
 * Сторінки лише для гостей (вхід, реєстрація). Авторизованого користувача (зокрема одразу
 * після входу) веде на сторінку, з якої його перенаправили на вхід, або на головну (UC-2).
 * @returns {JSX.Element} вкладений маршрут, індикатор або редірект.
 */
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
