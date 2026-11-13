import { useTranslation } from 'react-i18next';
import Icon from './Icon.jsx';

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
