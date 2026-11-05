/**
 * @module components/FormField
 * @description Поле форми: підпис, текстове поле і повідомлення про помилку.
 * Поле з помилкою підсвічується червоним (UC-1) і позначається `aria-invalid`.
 */

/**
 * Текстове поле форми з підписом і помилкою.
 * @param {object} props - властивості; решта передаються елементу `<input>`.
 * @param {string} props.name - назва поля (і основа id).
 * @param {string} props.label - підпис поля.
 * @param {string|null} [props.error] - текст помилки.
 * @param {import('react').ReactNode} [props.aside] - елемент праворуч від підпису (напр. «Забули пароль?»).
 * @param {import('react').ReactNode} [props.hint] - підказка під полем (напр. вимоги до пароля).
 * @returns {JSX.Element} поле форми.
 */
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
