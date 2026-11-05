/**
 * @module components/Icon
 * @description Набір SVG-іконок інтерфейсу (меню, плеєр). Іконки декоративні:
 * доступна назва задається атрибутом `aria-label` на кнопці чи посиланні.
 */

/** Контури іконок (viewBox 0 0 24 24). */
const PATHS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  search:
    'M10.5 3a7.5 7.5 0 0 1 5.9 12.13l4.24 4.24-1.41 1.41-4.24-4.24A7.5 7.5 0 1 1 10.5 3m0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11',
  library: 'M4 3h2v18H4zm5 0h2v18H9zm4.6.8 1.93-.52 4.66 17.39-1.93.52z',
  admin:
    'M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5zm0 5a3 3 0 1 1 0 6 3 3 0 0 1 0-6m0 13c-2-.7-3.7-2.1-4.7-3.9.1-1.6 3.1-2.5 4.7-2.5s4.6.9 4.7 2.5c-1 1.8-2.7 3.2-4.7 3.9',
  logout:
    'M10 3h9a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-9v-2h9V5h-9zm-.5 5.5L11 10l-1 1h7v2h-7l1 1-1.5 1.5L5 12z',
  play: 'M8 5.14v13.72a1 1 0 0 0 1.52.85l10.9-6.86a1 1 0 0 0 0-1.7L9.52 4.29A1 1 0 0 0 8 5.14',
  pause: 'M7 5h3.5v14H7zm6.5 0H17v14h-3.5z',
  next: 'M5 5.5v13a1 1 0 0 0 1.55.83L15 13.6V18h2.5V6H15v4.4L6.55 4.67A1 1 0 0 0 5 5.5',
  prev: 'M19 5.5v13a1 1 0 0 1-1.55.83L9 13.6V18H6.5V6H9v4.4l8.45-5.73A1 1 0 0 1 19 5.5',
  heart:
    'M12 20.7 10.6 19.4C5.4 14.7 2 11.6 2 7.8 2 4.7 4.4 2.3 7.5 2.3c1.7 0 3.4.8 4.5 2.1 1.1-1.3 2.8-2.1 4.5-2.1 3.1 0 5.5 2.4 5.5 5.5 0 3.8-3.4 6.9-8.6 11.6z',
  volume:
    'M3 9v6h4l5 5V4L7 9zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05A4.5 4.5 0 0 0 16.5 12M14 3.23v2.06a7 7 0 0 1 0 13.42v2.06a9 9 0 0 0 0-17.54',
  volumeMute: 'M3 9v6h4l5 5V4L7 9zm18.4.4L20 8l-3 3-3-3-1.4 1.4 3 3-3 3L14 17l3-3 3 3 1.4-1.4-3-3z',
  music: 'M12 3v10.55A4 4 0 1 0 14 17V7h4V3z',
  arrowRight: 'm12 4-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z',
  check: 'M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
  close:
    'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
};

/**
 * SVG-іконка.
 * @param {object} props - властивості.
 * @param {keyof typeof PATHS} props.name - назва іконки.
 * @param {number} [props.size=20] - розмір у пікселях.
 * @param {boolean} [props.outline=false] - лише контур (напр. незаповнене сердечко).
 * @param {string} [props.className] - CSS-клас.
 * @returns {JSX.Element} елемент `<svg>`.
 */
export default function Icon({ name, size = 20, outline = false, className }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={outline ? 'none' : 'currentColor'}
      stroke={outline ? 'currentColor' : undefined}
      strokeWidth={outline ? 2 : undefined}
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
