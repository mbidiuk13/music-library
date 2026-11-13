export default function FormField({ name, label, error, aside, hint, ...inputProps }) {
  const id = `field-${name}`;
  const errorId = `${id}-error`;
  return (
    <div className="field">
      <div className="field__head">
        <label className="field__label" htmlFor={id}>
          {label}
        </label>
        {aside}
      </div>
      <input
        id={id}
        name={name}
        className={error ? 'field__input field__input--invalid' : 'field__input'}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        {...inputProps}
      />
      {error && (
        <p id={errorId} className="field__error" role="alert">
          {error}
        </p>
      )}
      {hint}
    </div>
  );
}
