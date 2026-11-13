import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import uk from './locales/uk.json';

i18n.use(initReactI18next).init({
  resources: {
    uk: { translation: uk },
  },
  lng: 'uk',
  fallbackLng: 'uk',
  interpolation: {
    escapeValue: false, //React сам екранує значення
  },
});

function applyDocumentLanguage(language) {
  document.documentElement.lang = language;
  document.title = i18n.t('app.name');
}

applyDocumentLanguage(i18n.language);
i18n.on('languageChanged', applyDocumentLanguage);

export default i18n;
