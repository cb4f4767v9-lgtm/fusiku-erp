/** Shared cache for country-state-city API (Customer form, Branch form, etc.) */
export const locationCache: {
  countries?: { isoCode: string; name: string }[];
  provinces: Record<string, { isoCode: string; name: string }[]>;
  cities: Record<string, { name: string }[]>;
} = {
  provinces: {},
  cities: {}
};
