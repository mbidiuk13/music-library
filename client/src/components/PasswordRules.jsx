import { useTranslation } from 'react-i18next';
import { LIMITS, passwordRequirements } from '../utils/validation.js';
import Icon from './Icon.jsx';

export default function PasswordRules({ password }) {
  const { t } = useTranslation();
  return (
    <ul className="rules" aria-label={t('validation.password.rulesTitle')}>
      {passwordRequirements(password).map(({ key, isMet }) => (
        <li key={key} className={isMet ? 'rules__item rules__item--met' : 'rules__item'}>
          <Icon name={isMet ? 'check' : 'close'} size={14} />
          {t(key, LIMITS)}
        </li>
      ))}
    </ul>
  );
}
