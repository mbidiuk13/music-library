/**
 * @module components/TrackFormDialog
 * @description Форма треку в адмін-панелі (рис. 4.5 ТЗ): завантаження аудіо з метаданими (UC-9)
 * і модерація метаданих наявного треку (UC-6). Сім полів метаданих — назва, виконавець, жанр,
 * тональність, настрій, темп і рік; жанр, тональність і настрій обираються зі словників
 * `GET /api/meta/vocabularies`. Аудіофайл перевіряється ще на клієнті (лише MP3/WAV, до 50 МБ),
 * а сервер додатково перевіряє MIME-тип, вміст файлу й усі поля.
 */

import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchVocabularies } from '../api/tracks.js';
import useForm from '../hooks/useForm.js';
import useRequest from '../hooks/useRequest.js';
import { errorMessage } from '../utils/errors.js';
import { displayMood } from '../utils/format.js';
import {
  LIMITS,
  validateAudioFile,
  validateChoice,
  validateIntegerRange,
  validateTrackText,
} from '../utils/validation.js';
import FormField from './FormField.jsx';
import Modal from './Modal.jsx';
import { RequestError, TrackListSkeleton } from './RequestState.jsx';
import SelectField from './SelectField.jsx';

/** Коди помилок сервера, що стосуються саме аудіофайлу (показуються під полем файлу). */
const FILE_ERROR_CODES = new Set(['FILE_TOO_LARGE', 'UNSUPPORTED_MEDIA_TYPE', 'INVALID_UPLOAD']);

/** Кількість байтів в одному мегабайті (для показу розміру файлу). */
const BYTES_IN_MB = 1024 * 1024;

/**
 * Початкові значення полів: порожні для нового треку або поточні метадані для редагування.
 * @param {object|null} track - трек для редагування.
 * @returns {Record<string, string>} значення полів форми (рядки).
 */
function initialValuesFor(track) {
  return {
    title: track?.title ?? '',
    artist: track?.artist ?? '',
    genre: track?.genre ?? '',
    key_signature: track?.key_signature ?? '',
    mood: track?.mood ?? '',
    bpm: track ? String(track.bpm) : '',
    year: track ? String(track.year) : '',
  };
}

/**
 * Форма метаданих (показується, коли словники вже завантажено).
 * @param {object} props - властивості.
 * @param {{genres: string[], moods: string[], keys: string[]}} props.vocabularies - словники.
 * @param {object|null} props.track - трек для редагування або null для завантаження нового.
 * @param {(payload: FormData|object) => Promise<void>} props.onSubmit - збереження.
 * @param {() => void} props.onClose - закриття без змін.
 * @param {(busy: boolean) => void} props.onBusyChange - повідомляє, що виконується запит.
 * @returns {JSX.Element} форма.
 */
function TrackForm({ vocabularies, track, onSubmit, onClose, onBusyChange }) {
  const { t } = useTranslation();
  const isEdit = Boolean(track);
  const [initialValues] = useState(() => initialValuesFor(track));

  const validate = useCallback(
    (values) => ({
      title: validateTrackText(values.title, 'title'),
      artist: validateTrackText(values.artist, 'artist'),
      genre: validateChoice(values.genre, vocabularies.genres, 'genre'),
      key_signature: validateChoice(values.key_signature, vocabularies.keys, 'key'),
      mood: validateChoice(values.mood, vocabularies.moods, 'mood'),
      bpm: validateIntegerRange(values.bpm, LIMITS.bpmMin, LIMITS.bpmMax, 'bpm'),
      year: validateIntegerRange(values.year, LIMITS.yearMin, LIMITS.yearMax, 'year'),
    }),
    [vocabularies],
  );
  const { values, isValid, handleChange, handleBlur, fieldError, setServerErrors, touchAll } =
    useForm(initialValues, validate);

  const [file, setFile] = useState(/** @type {File|null} */ (null));
  const [fileTouched, setFileTouched] = useState(false);
  const [fileServerError, setFileServerError] = useState(/** @type {string|null} */ (null));
  const [formError, setFormError] = useState(/** @type {string|null} */ (null));
  const [isBusy, setIsBusy] = useState(false);

  const fileErrorKey = isEdit ? null : validateAudioFile(file);
  const fileError =
    fileServerError ?? (fileTouched && fileErrorKey ? t(fileErrorKey, LIMITS) : null);
  const canSubmit = isValid && !fileErrorKey && !isBusy;

  /**
   * Вибір аудіофайлу: перевірка розширення й розміру одразу, без надсилання на сервер.
   * @param {import('react').ChangeEvent<HTMLInputElement>} event - подія зміни поля файлу.
   * @returns {void}
   */
  const handleFileChange = (event) => {
    setFile(event.target.files?.[0] ?? null);
    setFileTouched(true);
    setFileServerError(null);
  };

  /**
   * Надсилає форму. Помилки файлу (413, 415) показуються під полем файлу, помилки полів
   * (400 VALIDATION_ERROR) — під відповідними полями, решта — над кнопками.
   * @param {import('react').FormEvent<HTMLFormElement>} event - подія надсилання.
   * @returns {Promise<void>}
   */
  const handleSubmit = async (event) => {
    event.preventDefault();
    touchAll();
    setFileTouched(true);
    if (!canSubmit) return;

    const metadata = {
      title: values.title.trim(),
      artist: values.artist.trim(),
      genre: values.genre,
      key_signature: values.key_signature,
      mood: values.mood,
      bpm: Number(values.bpm.trim()),
      year: Number(values.year.trim()),
    };
    let payload = metadata;
    if (!isEdit) {
      payload = new FormData();
      Object.entries(metadata).forEach(([name, value]) => payload.append(name, String(value)));
      payload.append('file', file);
    }

    setIsBusy(true);
    onBusyChange(true);
    setFormError(null);
    try {
      await onSubmit(payload);
    } catch (err) {
      if (FILE_ERROR_CODES.has(err.code)) {
        setFileServerError(errorMessage(err));
      } else {
        const details = err.details ?? [];
        setServerErrors(details.filter((detail) => detail.field !== 'file'));
        const fileDetail = details.find((detail) => detail.field === 'file');
        if (fileDetail) setFileServerError(fileDetail.message);
        setFormError(errorMessage(err));
      }
      setIsBusy(false);
      onBusyChange(false);
    }
  };

  const genreOptions = vocabularies.genres.map((genre) => ({ value: genre, label: genre }));
  const keyOptions = vocabularies.keys.map((key) => ({ value: key, label: key }));
  const moodOptions = vocabularies.moods.map((mood) => ({ value: mood, label: displayMood(mood) }));

  return (
    <form className="track-form" onSubmit={handleSubmit} noValidate>
      {!isEdit && (
        <div className="field track-form__wide">
          <div className="field__head">
            <label className="field__label" htmlFor="field-file">
              {t('admin.form.file')}
            </label>
          </div>
          <input
            id="field-file"
            name="file"
            type="file"
            accept=".mp3,.wav,audio/mpeg,audio/wav"
            className={fileError ? 'file-input file-input--invalid' : 'file-input'}
            onChange={handleFileChange}
            aria-invalid={Boolean(fileError)}
            aria-describedby={fileError ? 'field-file-error' : 'field-file-hint'}
          />
          {fileError ? (
            <p id="field-file-error" className="field__error" role="alert">
              {fileError}
            </p>
          ) : (
            <p id="field-file-hint" className="field__hint">
              {file
                ? t('admin.form.fileChosen', {
                    name: file.name,
                    size: (file.size / BYTES_IN_MB).toFixed(1),
                  })
                : t('admin.form.fileHint', LIMITS)}
            </p>
          )}
        </div>
      )}

      <FormField
        name="title"
        label={t('admin.form.title')}
        maxLength={LIMITS.trackTextMax}
        autoComplete="off"
        value={values.title}
        onChange={handleChange}
        onBlur={handleBlur}
        error={fieldError('title')}
      />
      <FormField
        name="artist"
        label={t('admin.form.artist')}
        maxLength={LIMITS.trackTextMax}
        autoComplete="off"
        value={values.artist}
        onChange={handleChange}
        onBlur={handleBlur}
        error={fieldError('artist')}
      />
      <SelectField
        name="genre"
        label={t('admin.form.genre')}
        placeholder={t('admin.form.choose')}
        options={genreOptions}
        value={values.genre}
        onChange={handleChange}
        onBlur={handleBlur}
        error={fieldError('genre')}
      />
      <SelectField
        name="mood"
        label={t('admin.form.mood')}
        placeholder={t('admin.form.choose')}
        options={moodOptions}
        value={values.mood}
        onChange={handleChange}
        onBlur={handleBlur}
        error={fieldError('mood')}
      />
      <SelectField
        name="key_signature"
        label={t('admin.form.key')}
        placeholder={t('admin.form.choose')}
        options={keyOptions}
        value={values.key_signature}
        onChange={handleChange}
        onBlur={handleBlur}
        error={fieldError('key_signature')}
      />
      <div className="track-form__pair">
        <FormField
          name="bpm"
          type="number"
          inputMode="numeric"
          label={t('admin.form.bpm')}
          min={LIMITS.bpmMin}
          max={LIMITS.bpmMax}
          step={1}
          value={values.bpm}
          onChange={handleChange}
          onBlur={handleBlur}
          error={fieldError('bpm')}
        />
        <FormField
          name="year"
          type="number"
          inputMode="numeric"
          label={t('admin.form.year')}
          min={LIMITS.yearMin}
          max={LIMITS.yearMax}
          step={1}
          value={values.year}
          onChange={handleChange}
          onBlur={handleBlur}
          error={fieldError('year')}
        />
      </div>

      {formError && (
        <p className="notice notice--error track-form__wide" role="alert">
          {formError}
        </p>
      )}

      <div className="modal__actions track-form__wide">
        <button type="button" className="btn-outline" onClick={onClose} disabled={isBusy}>
          {t('common.cancel')}
        </button>
        <button type="submit" className="btn-primary" disabled={!canSubmit}>
          {isEdit
            ? t(isBusy ? 'common.saving' : 'admin.form.saveChanges')
            : t(isBusy ? 'admin.form.uploading' : 'admin.form.upload')}
        </button>
      </div>
    </form>
  );
}

/**
 * Вікно форми треку.
 * @param {object} props - властивості.
 * @param {object|null} props.track - трек для редагування або null для завантаження нового.
 * @param {(payload: FormData|object) => Promise<void>} props.onSubmit - збереження (кидає ApiError).
 * @param {() => void} props.onClose - закриття вікна.
 * @returns {JSX.Element} модальне вікно.
 */
export default function TrackFormDialog({ track, onSubmit, onClose }) {
  const { t } = useTranslation();
  const { data, error, isLoading, reload } = useRequest(fetchVocabularies);
  const [isBusy, setIsBusy] = useState(false);
  return (
    <Modal
      title={t(track ? 'admin.form.editTitle' : 'admin.form.uploadTitle')}
      onClose={onClose}
      isBusy={isBusy}
      size="lg"
    >
      {track && <p className="modal__text">{t('admin.form.editing', { id: track.id })}</p>}
      {isLoading && <TrackListSkeleton rows={4} />}
      {error && <RequestError error={error} onRetry={reload} />}
      {data && (
        <TrackForm
          vocabularies={data}
          track={track}
          onSubmit={onSubmit}
          onClose={onClose}
          onBusyChange={setIsBusy}
        />
      )}
    </Modal>
  );
}
