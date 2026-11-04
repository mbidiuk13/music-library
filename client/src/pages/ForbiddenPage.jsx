/**
 * @module pages/ForbiddenPage
 * @description Сторінка 403: користувач без ролі адміністратора відкрив `/admin`.
 */

import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/**
 * Сторінка «Доступ заборонено».
 * @returns {JSX.Element} сторінка.
 */
export default function ForbiddenPage() {
  const { t } = useTranslation();
  return (
    <section className="page page--centered">
      <p className="page__code gradient-text">403</p>
      <h1 className="page__title">{t('pages.forbidden.title')}</h1>
      <p className="page__muted">{t('pages.forbidden.text')}</p>
      <Link className="btn-primary" to="/">
        {t('common.backHome')}
      </Link>
    </section>
  );
}
