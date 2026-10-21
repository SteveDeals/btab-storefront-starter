import { describe, expect, it } from 'vitest';
import { BtabError, buyState, createClient, money } from './btab';

type Seen = { url: string; init: RequestInit };

/** A fake btab: answers each call with the given status and body. No live calls. */
function fakeApi(status: number, body: unknown, headers: Record<string, string> = {}) {
  const seen: Seen[] = [];
  const fetch = (async (url: string, init: RequestInit) => {
    seen.push({ url, init });
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
  }) as unknown as typeof globalThis.fetch;
  const client = createClient({ baseUrl: 'https://api.test/api/storefront/v1/', publishableKey: 'btab_pk_test_x', fetch });
  return { client, seen };
}

const header = (s: Seen, name: string) => (s.init.headers as Record<string, string>)[name];
const cart = { id: 'cart_1', object: 'cart', currency: 'AUD', prices_include_gst: true, lines: [], item_count: 0, subtotal_cents: 0, expires_at: '' };

describe('Storefront API client', () => {
  it('listProducts: GET /products with the key header', async () => {
    const { client, seen } = fakeApi(200, { success: true, products: [{ id: 1, name: 'Mug' }], pagination: { page: 1 } });
    const r = await client.listProducts({ limit: 24 });
    expect(r.products[0].name).toBe('Mug');
    expect(seen[0].url).toBe('https://api.test/api/storefront/v1/products?limit=24');
    expect(header(seen[0], 'X-Btab-Storefront-Key')).toBe('btab_pk_test_x');
  });

  it('getProduct: GET /products/{id} returns the product', async () => {
    const { client, seen } = fakeApi(200, { success: true, product: { id: 56997, options: [{ name: 'Colour', values: ['Red', 'Blue', 'Green'] }] } });
    const p = await client.getProduct(56997);
    expect(p.options[0].values).toHaveLength(3);
    expect(seen[0].url).toMatch(/\/products\/56997$/);
  });

  it('createCart: POST /carts sends ids and quantities, never a price, with an Idempotency-Key', async () => {
    const { client, seen } = fakeApi(201, { success: true, cart });
    const c = await client.createCart([{ product_id: 1, quantity: 2 }]);
    expect(c.id).toBe('cart_1');
    expect(seen[0].init.method).toBe('POST');
    expect(JSON.parse(String(seen[0].init.body))).toEqual({ items: [{ product_id: 1, quantity: 2 }] });
    expect(header(seen[0], 'Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('getCart: GET /carts/{id}', async () => {
    const { client, seen } = fakeApi(200, { success: true, cart });
    await client.getCart('cart_1');
    expect(seen[0].url).toMatch(/\/carts\/cart_1$/);
  });

  it('updateCart: PATCH /carts/{id} replaces the lines', async () => {
    const { client, seen } = fakeApi(200, { success: true, cart });
    await client.updateCart('cart_1', [{ product_id: 1, quantity: 1, variant_id: 9 }]);
    expect(seen[0].init.method).toBe('PATCH');
    expect(header(seen[0], 'Idempotency-Key')).toBeUndefined();
  });

  it('estimateShipping: POST /carts/{id}/shipping-estimate with the postcode', async () => {
    const { client, seen } = fakeApi(200, { success: true, estimate: { available: false, reason: 'SHIPPING_VOLUME_UNKNOWN', refused: true, refusal_code: 'SHIPPING_VOLUME_UNKNOWN' } });
    const e = await client.estimateShipping('cart_1', '2000');
    expect(e.available).toBe(false);
    expect(JSON.parse(String(seen[0].init.body))).toEqual({ postal_code: '2000' });
  });

  it('sendEnquiry: POST /carts/{id}/enquiry', async () => {
    const { client, seen } = fakeApi(201, { success: true, enquiry: { id: 5, status: 'new' } });
    const r = await client.sendEnquiry('cart_1', { email: 'a@example.com', message: 'For 12 people' });
    expect(r.id).toBe(5);
    expect(seen[0].url).toMatch(/\/carts\/cart_1\/enquiry$/);
  });

  it('createCheckoutSession: POST /checkout_sessions returns continue_url', async () => {
    const { client, seen } = fakeApi(201, { success: true, checkout_session: { id: 'cs_1', status: 'open', continue_url: 'https://shop.btab.app/cart/continue?t=x' } });
    const s = await client.createCheckoutSession('cart_1', 'http://localhost:3000/thanks');
    expect(s.continue_url).toContain('/cart/continue');
    expect(JSON.parse(String(seen[0].init.body))).toEqual({ cart_id: 'cart_1', return_url: 'http://localhost:3000/thanks' });
  });

  it('getCheckoutSession: GET /checkout_sessions/{id}', async () => {
    const { client } = fakeApi(200, { success: true, checkout_session: { id: 'cs_1', status: 'complete', livemode: false } });
    expect((await client.getCheckoutSession('cs_1')).status).toBe('complete');
  });
});

describe('errors come back as BtabError with the API code', () => {
  it('RETURN_URL_NOT_ALLOWED', async () => {
    const { client } = fakeApi(400, { success: false, code: 'RETURN_URL_NOT_ALLOWED', message: 'not allowed' });
    const err = await client.createCheckoutSession('cart_1', 'https://evil.example/thanks').catch((e) => e);
    expect(err).toBeInstanceOf(BtabError);
    expect(err.code).toBe('RETURN_URL_NOT_ALLOWED');
    expect(err.status).toBe(400);
  });

  it('a rate limit gives RATE_LIMITED and the seconds to wait', async () => {
    const { client } = fakeApi(429, { success: false, message: 'Too many requests' }, { 'Retry-After': '17' });
    const err = await client.listProducts().catch((e) => e);
    expect(err.code).toBe('RATE_LIMITED');
    expect(err.retryAfterSeconds).toBe(17);
    expect(err.friendly).toContain('17 seconds');
  });

  it('CART_NOT_BUYABLE (a sold-out or enquiry-only line)', async () => {
    const { client } = fakeApi(409, { success: false, code: 'CART_NOT_BUYABLE', message: 'no' });
    const err = await client.createCheckoutSession('cart_1', 'http://localhost:3000/thanks').catch((e) => e);
    expect(err.code).toBe('CART_NOT_BUYABLE');
  });

  it('a network failure (or a CORS refusal) is NETWORK_ERROR', async () => {
    const fetch = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof globalThis.fetch;
    const client = createClient({ baseUrl: 'https://api.test', publishableKey: 'k', fetch });
    expect((await client.listProducts().catch((e) => e)).code).toBe('NETWORK_ERROR');
  });
});

describe('helpers', () => {
  it('buyState: enquiry-only → enquire, out of stock → sold_out', () => {
    expect(buyState({ enquiry_only: true, in_stock: true })).toBe('enquire');
    expect(buyState({ enquiry_only: false, in_stock: false })).toBe('sold_out');
    expect(buyState({ enquiry_only: false, in_stock: true })).toBe('buy');
  });
  it('money: cents to AUD', () => {
    expect(money(2500)).toBe('$25.00');
    expect(money(null)).toBe('—');
  });
});
