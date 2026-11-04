/**
 * @module components/PageStub
 * @description Тимчасова заготовка сторінки: заголовок і позначка «Сторінка в розробці».
 * Вміст сторінок з'явиться на етапі 8; маршрути й каркас уже працюють.
 */

import { useTranslation } from 'react-i18next';

/**
 * Заготовка сторінки.
 * @param {object} props - властивості.
 * @param {string} props.titleKey - ключ i18n заголовка сторінки.
 * @param {import('react').ReactNode} [props.children] - додатковий вміст (напр. посилання).
 * @returns {JSX.Element} розмітка заготовки.
 */
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
