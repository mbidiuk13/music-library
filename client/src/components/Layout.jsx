/**
 * @module components/Layout
 * @description Основний каркас застосунку: бічне меню зліва, контент сторінки, плеєр знизу.
 * Сторінка рендериться в `<Outlet/>`; меню й плеєр лишаються змонтованими під час навігації.
 * На телефоні (ширина < 768px) бічне меню згорнуте: зверху — панель з логотипом і кнопкою меню,
 * яка висуває меню поверх контенту. Плеєр займає власний рядок сітки, тож не перекриває вміст.
 */

import { useEffect, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Icon from './Icon.jsx';
import Logo from './Logo.jsx';
import PlayerBar from './PlayerBar.jsx';
import Sidebar from './Sidebar.jsx';

/**
 * Каркас сторінок з меню.
 * @returns {JSX.Element} розмітка каркаса.
 */
export default function Layout() {
  const { t } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Відкрите висувне меню закривається клавішею Esc.
  useEffect(() => {
    if (!isMenuOpen) return undefined;
    /**
     * @param {KeyboardEvent} event - натискання клавіші.
     * @returns {void}
     */
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsMenuOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMenuOpen]);

  /**
   * Закриває висувне меню (вибір пункту, клік поза меню).
   * @returns {void}
   */
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
