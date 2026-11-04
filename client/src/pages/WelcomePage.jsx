/**
 * @module pages/WelcomePage
 * @description Сторінка привітання з формою входу (рис. 4.1 ТЗ, маршрут `/welcome`).
 * Заготовка — форма входу реалізується на етапі 8; посилання для гостя вже працює.
 */

import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageStub from '../components/PageStub.jsx';

/**
 * Сторінка привітання.
 * @returns {JSX.Element} сторінка.
 */
export default function WelcomePage() {
  const { t } = useTranslation();
  return (
    <PageStub titleKey="pages.welcome.title">
      <Link className="btn-secondary" to="/">
        {t('auth.continueAsGuest')}
      </Link>
    </PageStub>
  );
}
