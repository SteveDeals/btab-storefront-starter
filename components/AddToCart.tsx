'use client';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { btab, BtabError, buyState, type CartItemInput, type ProductDetail, type Variant } from '@/lib/btab';

/** Only what the picker needs, so the page sends the browser nothing more. */
export type PickerProduct = Pick<ProductDetail, 'id' | 'enquiry_only' | 'in_stock' | 'options'> & {
  variants: Pick<Variant, 'id' | 'available_for_sale' | 'selected_options'>[];
};
import { cartId, setCartId } from '@/lib/cart-store';

/** Option picker + Add to cart. Enquiry-only goods get "Enquire"; sold-out goods get a disabled button. */
export default function AddToCart({ product }: { product: PickerProduct }) {
  const router = useRouter();
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const variant = useMemo(() => {
    if (!product.variants.length) return null;
    return (
      product.variants.find((v) => v.selected_options.every((o) => picked[o.name] === o.value)) || null
    );
  }, [product.variants, picked]);

  const state = buyState(product);
  const needsPick = product.variants.length > 0 && !variant;
  const variantSoldOut = variant ? !variant.available_for_sale : false;

  async function add(enquire: boolean) {
    setBusy(true);
    setError(null);
    try {
      const client = btab();
      const line: CartItemInput = { product_id: product.id, quantity: qty, ...(variant ? { variant_id: variant.id } : {}) };
      const id = cartId();
      if (id) {
        try {
          const cart = await client.getCart(id);
          const items: CartItemInput[] = cart.lines.map((l) => ({
            product_id: l.product_id,
            quantity: l.quantity,
            ...(l.variant_id ? { variant_id: l.variant_id } : {}),
          }));
          const same = items.find((i) => i.product_id === line.product_id && i.variant_id === line.variant_id);
          if (same) same.quantity += line.quantity;
          else items.push(line);
          await client.updateCart(id, items);
        } catch (e) {
          if (!(e instanceof BtabError && e.code === 'CART_NOT_FOUND')) throw e;
          setCartId((await client.createCart([line])).id); // the old cart expired
        }
      } else {
        setCartId((await client.createCart([line])).id);
      }
      window.dispatchEvent(new Event('btab-cart'));
      router.push(enquire ? '/cart#enquiry' : '/cart');
    } catch (e) {
      setError(e instanceof BtabError ? e.friendly : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {product.options.map((opt) => (
        <div key={opt.name}>
          <strong>{opt.name}</strong>
          <div className="opts">
            {opt.values.map((val) => (
              <button
                key={val}
                type="button"
                aria-pressed={picked[opt.name] === val}
                onClick={() => setPicked({ ...picked, [opt.name]: val })}
              >
                {val}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="row">
        <input
          className="qty"
          type="number"
          min={1}
          value={qty}
          aria-label="Quantity"
          onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
        />
        {state === 'enquire' ? (
          <button disabled={busy} onClick={() => add(true)}>
            Enquire
          </button>
        ) : state === 'sold_out' || variantSoldOut ? (
          <button disabled>Sold out</button>
        ) : (
          <button disabled={busy || needsPick} onClick={() => add(false)}>
            {needsPick ? `Choose ${product.options.map((o) => o.name.toLowerCase()).join(', ')}` : 'Add to cart'}
          </button>
        )}
      </div>
      {state === 'enquire' ? (
        <p className="muted">This item is sold by quote. Add it, then send your details from the cart.</p>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
