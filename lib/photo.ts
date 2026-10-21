/**
 * Product photos are served from the shop's own address: /photo/<token>.
 * The token is the photo's address at the API's image host, base64url-encoded.
 * app/photo/[token]/route.ts fetches it server-side and caches it for a day.
 */
export const PHOTO_HOST = 'https://images-direct.btab.app/';

export function photoUrl(src: string | null | undefined): string | null {
  if (!src || !src.startsWith(PHOTO_HOST)) return null;
  return `/photo/${Buffer.from(src.slice(PHOTO_HOST.length)).toString('base64url')}`;
}

export function photoSource(token: string): string | null {
  try {
    const path = Buffer.from(token, 'base64url').toString('utf8');
    if (!path || path.includes('..') || /^[a-z]+:\/\//i.test(path)) return null;
    return PHOTO_HOST + path;
  } catch {
    return null;
  }
}
