/**
 * @module components/Logo
 * @description Логотип застосунку: градієнтний знак і назва.
 */

import { useTranslation } from 'react-i18next';
import Icon from './Icon.jsx';

/**
 * Логотип MusicLibrary.
 * @returns {JSX.Element} знак і назва застосунку.
 */
export default function Logo() {
  const { t } = useTranslation();
  return (
    <span className="logo">
      <span className="logo__mark">
        <Icon name="music" size={18} />
      </span>
      <span className="logo__name">{t('app.name')}</span>
    </span>
  );
}
