import { Link, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Icon from './Icon.jsx';

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
