import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function ForbiddenPage() {
  const { t } = useTranslation();
  return (
    <section className="page page--centered">
      <p className="page__code gradient-text">{t('pages.forbidden.code')}</p>
      <h1 className="page__title">{t('pages.forbidden.title')}</h1>
      <p className="page__muted">{t('pages.forbidden.text')}</p>
      <Link className="btn-primary" to="/">
        {t('common.backHome')}
      </Link>
    </section>
  );
}
