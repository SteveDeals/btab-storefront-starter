/**
 * A tiny typed client for the btab Storefront API (/api/storefront/v1).
 *
 * One function per call this shop uses. Every refusal becomes a BtabError with
 * the API's `code` (for example RETURN_URL_NOT_ALLOWED, CART_NOT_BUYABLE,
 * ORIGIN_NOT_ALLOWED), the HTTP status and, on a 429, the seconds to wait.
 *
 * All money is an integer in Australian cents.
 */

export type Pagination = {
  page: number;
  limit: number;
  total_count: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
};

export type Sale = { was_cents: number; discount_percent: number } | null;

export type ProductCard = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  retail_price_cents: number;
  sale: Sale;
  price_range: { min_cents: number; max_cents: number } | null;
  in_stock: boolean;
  available_for_sale: boolean;
  stock_quantity: number | null;
  enquiry_only: boolean;
  has_variants: boolean;
  needs_option?: true;
  image_url: string | null;
  colour_dots?: { label: string; hex: string }[];
};

export type Variant = {
  id: number;
  public_sku: string | null;
  available_for_sale: boolean;
  quantity_available: number | null;
  selected_options: { name: string; value: string }[];
  image: { url: string; alt: string } | null;
  /** Only when this option has its own price; otherwise the product's price applies. */
  price_cents?: number;
};

export type ProductDetail = ProductCard & {
  options: { name: string; values: string[] }[];
  variants: Variant[];
  images: { url: string | null; thumb_url: string | null; alt: string; position: number | null }[];
};

export type CartItemInput = { product_id: number; quantity: number; variant_id?: number };

export type UnavailableReason = 'needs_option' | 'sold_out' | 'low_stock' | 'enquiry_only' | 'not_available';

export type CartLine = {
  product_id: number;
  variant_id: number | null;
  quantity: number;
  name: string | null;
  option_summary: string | null;
  unit_price_cents: number | null;
  line_total_cents: number | null;
  available: boolean;
  needs_option: boolean;
  enquiry_only: boolean;
  unavailable_reason: UnavailableReason | null;
  max_quantity: number | null;
};

export type Cart = {
  id: string;
  object: 'cart';
  currency: 'AUD';
  prices_include_gst: boolean;
  lines: CartLine[];
  item_count: number;
  subtotal_cents: number;
  expires_at: string;
};

export type ShippingEstimate =
  | {
      available: true;
      shipping_cents: number;
      free_over_met: boolean;
      delivery?: { min_days?: number | null; max_days?: number | null };
    }
  | {
      available: false;
      reason: string;
      refused: boolean;
      refusal_code?: 'SHIPPING_CARRIER_UNAVAILABLE' | 'SHIPPING_ZONE_NOT_COVERED' | 'SHIPPING_VOLUME_UNKNOWN';
      unavailable_product_ids?: number[];
    };

export type CheckoutSession = {
  id: string;
  object: 'checkout_session';
  status: 'open' | 'complete' | 'expired' | string;
  livemode: boolean;
  continue_url?: string;
  return_url: string;
  expires_at: string;
  completed_at: string | null;
};

export type EnquiryInput = { email: string; name?: string; phone?: string; company?: string; message?: string };

export class BtabError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryAfterSeconds: number | null;

  constructor(status: number, code: string, message: string, retryAfterSeconds: number | null = null) {
    super(message);
    this.name = 'BtabError';
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }

  /** A plain sentence a shopper can read. */
  get friendly(): string {
    switch (this.code) {
      case 'RATE_LIMITED':
        return `Too many requests. Please wait ${this.retryAfterSeconds ?? 60} seconds and try again.`;
      case 'CART_NOT_FOUND':
        return 'Your cart has expired. Please add the items again.';
      case 'CART_NOT_BUYABLE':
        return 'Some items in your cart cannot be bought online. Remove them or send an enquiry.';
      case 'RETURN_URL_NOT_ALLOWED':
        return 'This site is not on the key’s allowed sites, so checkout cannot return here.';
      case 'ORIGIN_NOT_ALLOWED':
        return 'This site is not on the key’s allowed sites. Add it in Settings → Developers.';
      default:
        return this.message;
    }
  }
}

export type ClientOptions = {
  baseUrl: string;
  publishableKey: string;
  fetch?: typeof fetch;
  /** Server pages only: cache reads for this many seconds (Next.js). Browser calls never cache. */
  revalidateSeconds?: number;
};

export type Client = ReturnType<typeof createClient>;

/** A random Idempotency-Key, so a retried POST never makes a second cart or session. */
export function idempotencyKey(): string {
  return globalThis.crypto.randomUUID();
}

export function createClient({ baseUrl, publishableKey, fetch: doFetch = globalThis.fetch, revalidateSeconds }: ClientOptions) {
  const base = baseUrl.replace(/\/+$/, '');

  async function call<T>(path: string, init: RequestInit & { idempotent?: boolean } = {}): Promise<T> {
    const { idempotent, ...rest } = init;
    const headers: Record<string, string> = {
      'X-Btab-Storefront-Key': publishableKey,
      Accept: 'application/json',
      ...(rest.body ? { 'Content-Type': 'application/json' } : {}),
      ...(idempotent ? { 'Idempotency-Key': idempotencyKey() } : {}),
      ...((rest.headers as Record<string, string>) || {}),
    };
    let res: Response;
    try {
      const caching: RequestInit & { next?: { revalidate: number } } =
        revalidateSeconds && (!rest.method || rest.method === 'GET')
          ? { next: { revalidate: revalidateSeconds } }
          : { cache: 'no-store' };
      res = await doFetch(`${base}${path}`, { ...rest, ...caching, headers });
    } catch {
      // A CORS refusal also lands here: the browser hides the answer.
      throw new BtabError(0, 'NETWORK_ERROR', 'Could not reach btab. Check your connection and that this site is on the key’s allowed sites.');
    }
    let body: Record<string, unknown> = {};
    try {
      body = (await res.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }
    if (!res.ok || body.success === false) {
      const retry = res.headers.get('Retry-After');
      const code = typeof body.code === 'string' ? body.code : res.status === 429 ? 'RATE_LIMITED' : `HTTP_${res.status}`;
      const message = typeof body.message === 'string' ? body.message : `btab answered ${res.status}`;
      throw new BtabError(res.status, code, message, retry ? Number(retry) : null);
    }
    return body as T;
  }

  const json = (data: unknown) => JSON.stringify(data);

  return {
    /** GET /products: the store's product list. */
    listProducts: (opts: { page?: number; limit?: number; q?: string } = {}) => {
      const qs = new URLSearchParams();
      if (opts.page) qs.set('page', String(opts.page));
      if (opts.limit) qs.set('limit', String(opts.limit));
      if (opts.q) qs.set('q', opts.q);
      const s = qs.toString();
      return call<{ products: ProductCard[]; pagination: Pagination }>(`/products${s ? `?${s}` : ''}`);
    },

    /** GET /products/{id}: one product with its options and variants. */
    getProduct: (idOrSlug: number | string) =>
      call<{ product: ProductDetail }>(`/products/${encodeURIComponent(String(idOrSlug))}`).then((r) => r.product),

    /** POST /carts: btab prices every line. Send ids and quantities, never a price. */
    createCart: (items: CartItemInput[]) =>
      call<{ cart: Cart }>('/carts', { method: 'POST', body: json({ items }), idempotent: true }).then((r) => r.cart),

    /** GET /carts/{id}: the cart, priced again. */
    getCart: (cartId: string) => call<{ cart: Cart }>(`/carts/${encodeURIComponent(cartId)}`).then((r) => r.cart),

    /** PATCH /carts/{id}: replaces every line. */
    updateCart: (cartId: string, items: CartItemInput[]) =>
      call<{ cart: Cart }>(`/carts/${encodeURIComponent(cartId)}`, { method: 'PATCH', body: json({ items }) }).then(
        (r) => r.cart,
      ),

    /** POST /carts/{id}/shipping-estimate: freight to a postcode. */
    estimateShipping: (cartId: string, postalCode: string) =>
      call<{ estimate: ShippingEstimate }>(`/carts/${encodeURIComponent(cartId)}/shipping-estimate`, {
        method: 'POST',
        body: json({ postal_code: postalCode }),
      }).then((r) => r.estimate),

    /** POST /carts/{id}/enquiry: a quote request for enquiry-only items. */
    sendEnquiry: (cartId: string, input: EnquiryInput) =>
      call<{ enquiry: { id: number; status: string } }>(`/carts/${encodeURIComponent(cartId)}/enquiry`, {
        method: 'POST',
        body: json(input),
        idempotent: true,
      }).then((r) => r.enquiry),

    /** POST /checkout_sessions: a link to the store's btab checkout. Send the buyer to continue_url. */
    createCheckoutSession: (cartId: string, returnUrl: string) =>
      call<{ checkout_session: CheckoutSession }>('/checkout_sessions', {
        method: 'POST',
        body: json({ cart_id: cartId, return_url: returnUrl }),
        idempotent: true,
      }).then((r) => r.checkout_session),

    /** GET /checkout_sessions/{id}: open, complete or expired. */
    getCheckoutSession: (id: string) =>
      call<{ checkout_session: CheckoutSession }>(`/checkout_sessions/${encodeURIComponent(id)}`).then(
        (r) => r.checkout_session,
      ),
  };
}

/** The client this app uses, from the NEXT_PUBLIC_ settings in .env.local. */
export function btab(opts: { revalidateSeconds?: number } = {}): Client {
  const baseUrl = process.env.NEXT_PUBLIC_BTAB_API_BASE || 'https://api.btab.app/api/storefront/v1';
  const publishableKey = process.env.NEXT_PUBLIC_BTAB_PUBLISHABLE_KEY || '';
  return createClient({ baseUrl, publishableKey, ...opts });
}

/** Can this product be added to a cart from a product card or page? */
export function buyState(p: Pick<ProductCard, 'enquiry_only' | 'in_stock'>): 'buy' | 'enquire' | 'sold_out' {
  if (p.enquiry_only) return 'enquire';
  if (!p.in_stock) return 'sold_out';
  return 'buy';
}

export function money(cents: number | null | undefined): string {
  if (cents == null) return '—';
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);
}
