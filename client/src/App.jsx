/**
 * @file Кореневий компонент застосунку з маршрутизацією сторінок.
 */

import { Routes, Route } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/**
 * Тимчасова стартова сторінка каркаса (буде замінена сторінками з етапу 8).
 * @returns {JSX.Element} заголовок і короткий опис застосунку.
 */
function Placeholder() {
  const { t } = useTranslation();
  return (
    <main className="placeholder">
      <h1>{t('app.name')}</h1>
      <p>{t('app.tagline')}</p>
    </main>
  );
}

/**
 * Кореневий компонент: описує маршрути SPA.
 * @returns {JSX.Element} дерево маршрутів.
 */
export default function App() {
  return (
    <Routes>
      <Route path="*" element={<Placeholder />} />
    </Routes>
  );
}
