/**
 * @file Ініціалізація i18next. Усі тексти інтерфейсу зберігаються у файлах `locales/*.json`;
 * щоб підключити нову мову, достатньо додати файл перекладу в `resources`.
 * Атрибут `lang` сторінки і заголовок вкладки браузера беруться з поточної мови.
 */

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
    escapeValue: false, // React сам екранує значення
  },
});

/**
 * Синхронізує мову документа (`<html lang>`) і заголовок вкладки з поточною мовою інтерфейсу.
 * @param {string} language - код мови, напр. `uk`.
 * @returns {void}
 */
function applyDocumentLanguage(language) {
  document.documentElement.lang = language;
  document.title = i18n.t('app.name');
}

applyDocumentLanguage(i18n.language);
i18n.on('languageChanged', applyDocumentLanguage);

export default i18n;
