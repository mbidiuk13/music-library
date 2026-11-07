/**
 * @module pages/NotFoundPage
 * @description Сторінка 404 для невідомих маршрутів.
 */

import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/**
 * Сторінка «Сторінку не знайдено».
 * @returns {JSX.Element} сторінка.
 */
export default function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <section className="page page--centered">
      <p className="page__code gradient-text">{t('pages.notFound.code')}</p>
      <h1 className="page__title">{t('pages.notFound.title')}</h1>
      <p className="page__muted">{t('pages.notFound.text')}</p>
      <Link className="btn-primary" to="/">
        {t('common.backHome')}
      </Link>
    </section>
  );
}
