/**
 * @module components/Sidebar
 * @description Бічне меню (рис. 4.2–4.5 ТЗ): логотип, навігація і блок користувача.
 * Пункт «Медіатека» бачать лише авторизовані, «Адмін-панель» — лише адміністратор
 * (на сервері ці розділи додатково захищені). На телефоні меню висувне: його відкриває кнопка
 * у верхній панелі (Layout), а вибір пункту меню закриває його.
 */

import { Link, NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.jsx';
import Icon from './Icon.jsx';
import Logo from './Logo.jsx';

/**
 * Обчислює CSS-клас пункту меню з урахуванням активного стану.
 * @param {{isActive: boolean}} state - стан посилання від NavLink.
 * @returns {string} CSS-клас.
 */
const navLinkClass = ({ isActive }) => (isActive ? 'nav__link nav__link--active' : 'nav__link');

/**
 * Бічне меню застосунку.
 * @param {object} props - властивості.
 * @param {string} props.id - id елемента (на нього посилається кнопка меню через aria-controls).
 * @param {() => void} props.onNavigate - вибрано пункт меню (закриває висувне меню на телефоні).
 * @returns {JSX.Element} розмітка меню.
 */
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
