/**
 * @module components/AuthLayout
 * @description Каркас сторінок входу, реєстрації й відновлення пароля (рис. 4.1 ТЗ):
 * логотип і картка з формою по центру екрана, без бічного меню.
 */

import { Link, Outlet } from 'react-router-dom';
import Logo from './Logo.jsx';

/**
 * Каркас сторінок автентифікації.
 * @returns {JSX.Element} розмітка каркаса.
 */
export default function AuthLayout() {
  return (
    <div className="auth-layout">
      <Link to="/" className="auth-layout__logo">
        <Logo />
      </Link>
      <div className="auth-layout__card">
        <Outlet />
      </div>
    </div>
  );
}
