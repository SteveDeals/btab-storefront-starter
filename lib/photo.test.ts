import { describe, expect, it } from 'vitest';
import { photoSource, photoUrl } from './photo';

describe('photos from the shop’s own address', () => {
  it('round-trips an image-host URL through an opaque token', () => {
    const src = 'https://images-direct.btab.app/sig/rs:fit:1200:0/plain/s3://bucket/a.jpg@webp';
    const url = photoUrl(src)!;
    expect(url).toMatch(/^\/photo\/[A-Za-z0-9_-]+$/);
    expect(url).not.toMatch(/btab/i);
    expect(photoSource(url.slice('/photo/'.length))).toBe(src);
  });
  it('refuses any other host', () => {
    expect(photoUrl('https://evil.example/a.jpg')).toBeNull();
    expect(photoSource(Buffer.from('https://evil.example/a.jpg').toString('base64url'))).toBeNull();
  });
});
