/**
 * @file Ініціалізація i18next. Усі тексти інтерфейсу зберігаються у файлах `locales/*.json`;
 * щоб підключити нову мову, достатньо додати файл перекладу в `resources`.
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

export default i18n;
