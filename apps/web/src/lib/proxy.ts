export function getSetCookies(headers: Headers): string[] {
  const enhanced = headers as Headers & { getSetCookie?: () => string[] };
  const values = enhanced.getSetCookie?.();
  if (values?.length) return values;
  const combined = headers.get('set-cookie');
  return combined ? [combined] : [];
}
