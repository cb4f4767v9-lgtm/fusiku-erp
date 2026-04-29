/** Mirrors backend envelope `meta` (language / direction / currency). */
export type ApiResponseMeta = {
  language: string;
  direction: 'ltr' | 'rtl';
  currency: string;
};

let lastMeta: ApiResponseMeta | null = null;

export function setLastApiResponseMeta(meta: ApiResponseMeta | null) {
  lastMeta = meta;
}

export function getLastApiResponseMeta(): ApiResponseMeta | null {
  return lastMeta;
}
