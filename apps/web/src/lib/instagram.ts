export const INSTAGRAM_HANDLE = '@dollz.lb';
export const DEFAULT_INSTAGRAM_URL = 'https://www.instagram.com/dollz.lb/';

export function instagramUrl(value?: string | null) {
  return value?.trim() || DEFAULT_INSTAGRAM_URL;
}
