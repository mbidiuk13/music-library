/*значення обирається зі словника, а не вводиться текстом, щоб one-hot кодування в Recommendation
Engine не ламалося від різного написання*/

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
