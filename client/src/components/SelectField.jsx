/**
 * @module components/SelectField
 * @description Поле вибору зі списку (жанр, тональність, настрій у формі адміністратора): значення
 * обирається зі словника, а не вводиться текстом, щоб one-hot кодування в Recommendation Engine
 * не ламалося від різного написання («Рок»/«рок»/«Rock»). Оформлення й помилка — як у FormField.
 */

/**
 * Поле вибору з підписом і помилкою.
 * @param {object} props - властивості; решта передаються елементу `<select>`.
 * @param {string} props.name - назва поля (і основа id).
 * @param {string} props.label - підпис поля.
 * @param {{value: string, label: string}[]} props.options - варіанти вибору.
 * @param {string} props.placeholder - текст порожнього варіанта («Оберіть…»).
 * @param {string|null} [props.error] - текст помилки.
 * @returns {JSX.Element} поле вибору.
 */
export default function SelectField({ name, label, options, placeholder, error, ...selectProps }) {
  const id = `field-${name}`;
  const errorId = `${id}-error`;
  const classes = ['field__input', 'field__select'];
  if (!selectProps.value) classes.push('field__select--empty');
  if (error) classes.push('field__input--invalid');
  return (
    <div className="field">
      <div className="field__head">
        <label className="field__label" htmlFor={id}>
          {label}
        </label>
      </div>
      <select
        id={id}
        name={name}
        className={classes.join(' ')}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        {...selectProps}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={errorId} className="field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
