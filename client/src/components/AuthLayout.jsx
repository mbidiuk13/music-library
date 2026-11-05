/**
 * @module components/AuthLayout
 * @description Каркас сторінок входу, реєстрації й відновлення пароля (рис. 4.1 ТЗ):
 * картка по центру екрана з градієнтним знаком застосунку, без бічного меню.
 */

import { Link, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Icon from './Icon.jsx';

/**
 * Каркас сторінок автентифікації.
 * @returns {JSX.Element} розмітка каркаса.
 */
export default function AuthLayout() {
  const { t } = useTranslation();
  return (
    <div className="auth-layout">
      <main className="auth-card">
        <Link to="/" className="auth-card__mark" aria-label={t('common.backHome')}>
          <Icon name="music" size={36} />
        </Link>
        <Outlet />
      </main>
    </div>
  );
}
