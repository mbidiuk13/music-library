import { Link, NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.jsx';
import Icon from './Icon.jsx';
import Logo from './Logo.jsx';

const navLinkClass = ({ isActive }) => (isActive ? 'nav__link nav__link--active' : 'nav__link');

export default function Sidebar({ id, onNavigate }) {
  const { t } = useTranslation();
  const { user, isAuthenticated, isAdmin, logout } = useAuth();

  const items = [
    { to: '/', icon: 'home', label: t('nav.home'), end: true, visible: true },
    { to: '/search', icon: 'search', label: t('nav.search'), visible: true },
    { to: '/playlists', icon: 'library', label: t('nav.library'), visible: isAuthenticated },
    { to: '/admin', icon: 'admin', label: t('nav.admin'), visible: isAdmin },
  ];

  return (
    <aside id={id} className="sidebar">
      <Link to="/" className="sidebar__logo" onClick={onNavigate}>
        <Logo />
      </Link>

      <nav className="nav" aria-label={t('nav.mainMenu')}>
        {items
          .filter((item) => item.visible)
          .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={navLinkClass}
              onClick={onNavigate}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
      </nav>

      <div className="sidebar__account">
        {isAuthenticated ? (
          <div className="account">
            <span className="account__avatar" aria-hidden="true">
              {user.username.charAt(0).toUpperCase()}
            </span>
            <span className="account__info">
              <span className="account__name">{user.username}</span>
              <span className="account__role">
                {t(isAdmin ? 'auth.roleAdmin' : 'auth.roleUser')}
              </span>
            </span>
            <button
              type="button"
              className="icon-button"
              onClick={() => {
                onNavigate();
                logout();
              }}
              aria-label={t('auth.logout')}
              title={t('auth.logout')}
            >
              <Icon name="logout" />
            </button>
          </div>
        ) : (
          <div className="account account--guest">
            <p className="account__hint">{t('auth.loginHint')}</p>
            <Link to="/welcome" className="btn-primary" onClick={onNavigate}>
              {t('auth.login')}
            </Link>
          </div>
        )}
      </div>
    </aside>
  );
}
