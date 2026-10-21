import { photoSource } from '@/lib/photo';

/** GET /photo/<token>: a product photo, fetched from the image host and cached for a day. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const src = photoSource((await params).token);
  if (!src) return new Response('Not found', { status: 404 });
  const upstream = await fetch(src, { next: { revalidate: 86400 } });
  const type = upstream.headers.get('content-type') || '';
  if (!upstream.ok || !type.startsWith('image/')) return new Response('Not found', { status: 404 });
  return new Response(upstream.body, {
    headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800' },
  });
}
