/*фіксовані словники дають єдине написання категорій (без «Рок»/«рок»/«Rock») і коректне
one-hot кодування. Значення мають збігатися з database/seed.sql символ у символ*/
export const GENRES = Object.freeze([
  'Електроніка',
  'Поп',
  'Інді',
  'Рок',
  'Хіп-хоп',
  'Джаз',
  'Чіл',
  'Класика',
  'Пост-панк',
  'Поп-фолк',
  'Фолк',
  'Метал',
]);

//з малої літери; з великої — лише при відображенні на клієнті
export const MOODS = Object.freeze([
  'енергійний',
  'радісний',
  'спокійний',
  'меланхолійний',
  'сумний',
  'романтичний',
  'агресивний',
  'мрійливий',
]);

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const MODES = ['major', 'minor'];

export const KEYS = Object.freeze(NOTES.flatMap((note) => MODES.map((mode) => `${note} ${mode}`)));

export const BPM_RANGE = Object.freeze({ min: 40, max: 250 });

//нижньої межі на кшталт 1900 немає — у медіатеці є класика
export function getYearRange(now = new Date()) {
  return { min: 1, max: now.getFullYear() + 1 };
}
