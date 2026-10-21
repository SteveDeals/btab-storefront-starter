'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { btab } from '@/lib/btab';
import { cartId } from '@/lib/cart-store';

export default function CartLink() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    const load = () => {
      const id = cartId();
      if (!id) return setCount(0);
      btab()
        .getCart(id)
        .then((c) => setCount(c.lines.reduce((n, l) => n + l.quantity, 0)))
        .catch(() => setCount(0));
    };
    load();
    window.addEventListener('btab-cart', load);
    return () => window.removeEventListener('btab-cart', load);
  }, []);
  return <Link href="/cart">Cart{count ? ` (${count})` : ''}</Link>;
}
