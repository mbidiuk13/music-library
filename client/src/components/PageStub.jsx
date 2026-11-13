import { useTranslation } from 'react-i18next';

export default function PageStub({ titleKey, children }) {
  const { t } = useTranslation();
  return (
    <section className="page">
      <h1 className="page__title">{t(titleKey)}</h1>
      <p className="page__muted">{t('pages.stub')}</p>
      {children}
    </section>
  );
}
