export const STORE_COUNTRIES = [
  ['LB', 'Lebanon'],
  ['AE', 'United Arab Emirates'],
  ['SA', 'Saudi Arabia'],
  ['QA', 'Qatar'],
  ['KW', 'Kuwait'],
  ['JO', 'Jordan'],
  ['US', 'United States'],
  ['CA', 'Canada'],
  ['GB', 'United Kingdom'],
  ['FR', 'France'],
  ['DE', 'Germany'],
] as const;

export function countryName(code: string) {
  return STORE_COUNTRIES.find(([value]) => value === code)?.[1] ?? code;
}
