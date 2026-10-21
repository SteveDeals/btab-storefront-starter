'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { btab, type CheckoutSession } from '@/lib/btab';
import { sessionId, setCartId, setSessionId } from '@/lib/cart-store';

/** The return_url. Checks the checkout session; when it is complete, the cart is done. */
export default function Thanks() {
  const [session, setSession] = useState<CheckoutSession | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const id = sessionId();
    if (!id) return setChecked(true);
    btab()
      .getCheckoutSession(id)
      .then((s) => {
        setSession(s);
        if (s.status === 'complete') {
          setCartId(null);
          setSessionId(null);
        }
      })
      .catch(() => undefined)
      .finally(() => setChecked(true));
  }, []);

  if (!checked) return <p>Checking your order…</p>;
  if (session?.status === 'complete')
    return (
      <>
        <h1>Thank you</h1>
        <p>Your order is placed.{session.livemode ? '' : ' This was a test order: nothing was charged or sent.'}</p>
        <Link href="/">Keep shopping</Link>
      </>
    );
  return (
    <>
      <h1>Your order is not finished</h1>
      <p>{session ? `Checkout is ${session.status}.` : 'No checkout found.'} <Link href="/cart">Back to your cart</Link></p>
    </>
  );
}
