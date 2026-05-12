import i18n from '../i18n';
import { extractApiErrorRawText, getErrorMessage, isLikelyDbSchemaMismatchMessage } from './getErrorMessage';

/**
 * Secondary line under "Unable to load data": show API/body message when it
 * adds information and is not redundant with the headline or a useless Axios
 * status string.
 */
export function instituteErrorHint(detail: string, headline: string): string | undefined {
  const d = detail.trim();
  const h = headline.trim();
  if (!d || d === h) return undefined;
  if (/^request failed with status code \d+$/i.test(d)) return undefined;
  return d;
}

export type InstituteLoadError = {
  title: string;
  hint?: string;
  /** Dev-only: one-line raw excerpt inside a monospace block — never a full stack. */
  technicalDetails?: string;
};

function truncateTechnical(raw: string, max = 560): string {
  const flat = raw.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max)}…`;
}

export function instituteParseAxiosError(err: unknown, headline: string): InstituteLoadError {
  const raw = extractApiErrorRawText(err);
  const schemaMismatch = isLikelyDbSchemaMismatchMessage(raw);

  const title = schemaMismatch ? i18n.t('errors.databaseSchemaTitle') : headline;

  const sanitizedDetail = getErrorMessage(err, headline).trim();
  const hint = schemaMismatch ? i18n.t('errors.databaseSchemaHint') : instituteErrorHint(sanitizedDetail, title);

  const technicalDetails =
    import.meta.env.DEV && raw.trim().length > 0 ? truncateTechnical(raw) : undefined;

  return {
    title,
    ...(hint ? { hint } : {}),
    ...(technicalDetails ? { technicalDetails } : {}),
  };
}
