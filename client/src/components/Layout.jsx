/**
 * @module components/Layout
 * @description Основний каркас застосунку: бічне меню зліва, контент сторінки, плеєр знизу.
 * Сторінка рендериться в `<Outlet/>`; меню й плеєр лишаються змонтованими під час навігації.
 */

import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';

/**
 * Каркас сторінок з меню.
 * @returns {JSX.Element} розмітка каркаса.
 */
export default function Layout() {
  return (
    <div className="layout">
      <Sidebar />
      <main className="layout__content">
        <Outlet />
      </main>
    </div>
  );
}
