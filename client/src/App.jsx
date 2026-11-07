/**
 * @file Кореневий компонент застосунку: маршрути SPA (розділ 9 SPEC).
 * Провайдери автентифікації й плеєра розташовані вище (main.jsx), тому зміна
 * маршруту не перериває відтворення музики. Якщо сесію не вдалося відновити (немає зв'язку
 * із сервером), замість сторінок показується помилка з кнопкою «Спробувати ще раз».
 */

import { Route, Routes } from 'react-router-dom';
import AuthLayout from './components/AuthLayout.jsx';
import Layout from './components/Layout.jsx';
import { RequestError } from './components/RequestState.jsx';
import { GuestOnly, RequireAdmin, RequireAuth } from './components/RouteGuards.jsx';
import { useAuth } from './context/AuthContext.jsx';
import AdminPage from './pages/AdminPage.jsx';
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx';
import HomePage from './pages/HomePage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import PlaylistDetailPage from './pages/PlaylistDetailPage.jsx';
import PlaylistsPage, { PlaylistsIndex } from './pages/PlaylistsPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';
import SearchPage from './pages/SearchPage.jsx';
import WelcomePage from './pages/WelcomePage.jsx';

/**
 * Кореневий компонент: описує маршрути SPA.
 * @returns {JSX.Element} дерево маршрутів або екран помилки відновлення сесії.
 */
export default function App() {
  const { status, sessionError, retrySession } = useAuth();

  if (status === 'error') {
    return (
      <main className="app-error">
        <RequestError error={sessionError} onRetry={retrySession} />
      </main>
    );
  }

  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route element={<GuestOnly />}>
          <Route path="/welcome" element={<WelcomePage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Route>

      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/playlists" element={<PlaylistsPage />}>
            <Route index element={<PlaylistsIndex />} />
            <Route path=":id" element={<PlaylistDetailPage />} />
          </Route>
        </Route>
        <Route element={<RequireAdmin />}>
          <Route path="/admin" element={<AdminPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
