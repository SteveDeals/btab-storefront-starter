'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { btab, BtabError, money, type Cart, type CartItemInput, type ShippingEstimate } from '@/lib/btab';
import { cartId, setCartId, setSessionId } from '@/lib/cart-store';

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/+$/, '');

const REASONS: Record<string, string> = {
  sold_out: 'Sold out',
  low_stock: 'Not enough stock',
  enquiry_only: 'Sold by quote: send an enquiry below',
  needs_option: 'Choose an option on the product page',
  not_available: 'Not available',
};

function freightText(e: ShippingEstimate): string {
  if (e.available) return e.shipping_cents === 0 ? 'Free delivery' : `Delivery ${money(e.shipping_cents)}`;
  if (e.refusal_code === 'SHIPPING_VOLUME_UNKNOWN') return 'Needs a freight quote. Send an enquiry.';
  if (e.refusal_code === 'SHIPPING_ZONE_NOT_COVERED') return 'We do not deliver to this postcode.';
  if (e.reason === 'items_unavailable') return 'Some items cannot be delivered. Remove them first.';
  return 'No freight price for this postcode.';
}

export default function CartPage() {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [postcode, setPostcode] = useState('');
  const [estimate, setEstimate] = useState<ShippingEstimate | null>(null);
  const [busy, setBusy] = useState(false);
  const [enquiry, setEnquiry] = useState({ email: '', name: '', message: '' });
  const [enquirySent, setEnquirySent] = useState(false);

  const fail = (e: unknown) => setError(e instanceof BtabError ? `${e.friendly} (${e.code})` : 'Something went wrong.');

  const load = useCallback(async () => {
    const id = cartId();
    if (!id) return setLoaded(true);
    try {
      setCart(await btab().getCart(id));
    } catch (e) {
      if (e instanceof BtabError && e.code === 'CART_NOT_FOUND') setCartId(null);
      else fail(e);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function change(index: number, quantity: number) {
    if (!cart) return;
    setBusy(true);
    setError(null);
    setEstimate(null);
    try {
      const items: CartItemInput[] = cart.lines
        .map((l, i) => ({
          product_id: l.product_id,
          quantity: i === index ? quantity : l.quantity,
          ...(l.variant_id ? { variant_id: l.variant_id } : {}),
        }))
        .filter((l) => l.quantity > 0);
      if (!items.length) {
        setCartId(null);
        setCart(null);
        return;
      }
      setCart(await btab().updateCart(cart.id, items));
      window.dispatchEvent(new Event('btab-cart'));
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  async function quote(e: React.FormEvent) {
    e.preventDefault();
    if (!cart) return;
    setBusy(true);
    setError(null);
    try {
      setEstimate(await btab().estimateShipping(cart.id, postcode.trim()));
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function checkout() {
    if (!cart) return;
    setBusy(true);
    setError(null);
    try {
      const session = await btab().createCheckoutSession(cart.id, `${siteUrl || window.location.origin}/thanks`);
      setSessionId(session.id);
      if (session.continue_url) window.location.href = session.continue_url;
    } catch (e) {
      fail(e);
      setBusy(false);
    }
  }

  async function sendEnquiry(e: React.FormEvent) {
    e.preventDefault();
    if (!cart) return;
    setBusy(true);
    setError(null);
    try {
      await btab().sendEnquiry(cart.id, enquiry);
      setEnquirySent(true);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return <p>Loading your cart…</p>;
  if (!cart || !cart.lines.length)
    return (
      <>
        <h1>Your cart</h1>
        <p>Your cart is empty. <Link href="/">Shop</Link></p>
        {error ? <p className="error">{error}</p> : null}
      </>
    );

  const blocked = cart.lines.some((l) => !l.available);
  const hasEnquiry = cart.lines.some((l) => l.enquiry_only);

  return (
    <>
      <h1>Your cart</h1>
      <table className="lines">
        <thead>
          <tr><th>Item</th><th>Qty</th><th>Price</th></tr>
        </thead>
        <tbody>
          {cart.lines.map((l, i) => (
            <tr key={`${l.product_id}-${l.variant_id ?? 0}`}>
              <td>
                <Link href={`/products/${l.product_id}`}>{l.name}</Link>
                {l.option_summary ? <div className="muted">{l.option_summary}</div> : null}
                {!l.available && l.unavailable_reason ? (
                  <div className={l.unavailable_reason === 'enquiry_only' ? 'muted' : 'error'}>
                    {REASONS[l.unavailable_reason] || 'Not available'}
                  </div>
                ) : null}
              </td>
              <td>
                <div className="row">
                  <input
                    className="qty"
                    type="number"
                    min={0}
                    max={l.max_quantity ?? undefined}
                    defaultValue={l.quantity}
                    aria-label={`Quantity of ${l.name}`}
                    onBlur={(e) => Number(e.target.value) !== l.quantity && change(i, Number(e.target.value) || 0)}
                  />
                  <button className="ghost" disabled={busy} onClick={() => change(i, 0)}>Remove</button>
                </div>
              </td>
              <td>{money(l.line_total_cents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        <strong>Subtotal {money(cart.subtotal_cents)}</strong>{' '}
        <span className="muted">{cart.prices_include_gst ? 'incl. GST' : 'excl. GST'}</span>
      </p>

      <form className="box" onSubmit={quote}>
        <strong>Delivery</strong>
        <div className="row" style={{ marginTop: 8 }}>
          <input
            style={{ maxWidth: 160 }}
            inputMode="numeric"
            pattern="\d{4}"
            placeholder="Postcode"
            aria-label="Postcode"
            value={postcode}
            onChange={(e) => setPostcode(e.target.value)}
            required
          />
          <button className="ghost" disabled={busy}>Get freight price</button>
          {estimate ? <span>{freightText(estimate)}</span> : null}
        </div>
      </form>

      <div className="box">
        {blocked ? (
          <p className="muted">Remove the items that cannot be bought online, or send an enquiry for them.</p>
        ) : null}
        <button disabled={busy || blocked || cart.subtotal_cents === 0} onClick={checkout}>
          Check out
        </button>
        <p className="muted">You pay on the store’s secure btab checkout.</p>
      </div>

      {hasEnquiry ? (
        <form id="enquiry" className="box" onSubmit={sendEnquiry}>
          <strong>Ask for a quote</strong>
          {enquirySent ? (
            <p>Thank you. The store will reply by email.</p>
          ) : (
            <>
              <p className="muted">For the items sold by quote. The store replies by email.</p>
              <p><input type="email" required placeholder="Email" value={enquiry.email} onChange={(e) => setEnquiry({ ...enquiry, email: e.target.value })} /></p>
              <p><input placeholder="Name" value={enquiry.name} onChange={(e) => setEnquiry({ ...enquiry, name: e.target.value })} /></p>
              <p><textarea rows={3} placeholder="Message" value={enquiry.message} onChange={(e) => setEnquiry({ ...enquiry, message: e.target.value })} /></p>
              <button disabled={busy}>Send enquiry</button>
            </>
          )}
        </form>
      ) : null}

      {error ? <p className="error">{error}</p> : null}
    </>
  );
}
