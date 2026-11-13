import { useEffect, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Icon from './Icon.jsx';
import Logo from './Logo.jsx';
import PlayerBar from './PlayerBar.jsx';
import Sidebar from './Sidebar.jsx';

export default function Layout() {
  const { t } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  //відкрите висувне меню закривається клавішею Esc
  useEffect(() => {
    if (!isMenuOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsMenuOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMenuOpen]);

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <div className={isMenuOpen ? 'layout layout--menu-open' : 'layout'}>
      <header className="topbar">
        <button
          type="button"
          className="icon-button topbar__menu"
          onClick={() => setIsMenuOpen((open) => !open)}
          aria-expanded={isMenuOpen}
          aria-controls="sidebar"
          aria-label={t(isMenuOpen ? 'nav.closeMenu' : 'nav.openMenu')}
          title={t(isMenuOpen ? 'nav.closeMenu' : 'nav.openMenu')}
        >
          <Icon name={isMenuOpen ? 'close' : 'menu'} size={24} />
        </button>
        <Link to="/" className="topbar__logo" onClick={closeMenu}>
          <Logo />
        </Link>
      </header>

      <Sidebar id="sidebar" onNavigate={closeMenu} />
      <div className="sidebar-backdrop" onClick={closeMenu} aria-hidden="true" />

      <main className="layout__content">
        <Outlet />
      </main>
      <PlayerBar />
    </div>
  );
}
