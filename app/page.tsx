/* eslint-disable @next/next/no-img-element -- btab sends signed image URLs; a plain img keeps the starter simple */
import Link from 'next/link';
import { btab, BtabError } from '@/lib/btab';
import Price from '@/components/Price';
import StockTag from '@/components/StockTag';

export const dynamic = 'force-dynamic';

export default async function Home() {
  try {
    const { products } = await btab({ revalidateSeconds: 60 }).listProducts({ limit: 24 });
    if (!products.length) return <p>No products yet.</p>;
    return (
      <>
        <h1>Shop</h1>
        <div className="grid">
          {products.map((p) => (
            <Link key={p.id} href={`/products/${p.id}`} className="card">
              {p.image_url ? <img src={p.image_url} alt={p.name} loading="lazy" /> : <img alt="" />}
              <h3>{p.name}</h3>
              <Price p={p} />
              <StockTag p={p} />
            </Link>
          ))}
        </div>
      </>
    );
  } catch (e) {
    const err = e instanceof BtabError ? e : null;
    return (
      <div className="box">
        <h1>Could not load the shop</h1>
        <p className="error">
          {err ? `${err.code}: ${err.friendly}` : 'Unknown error.'}
        </p>
        <p className="muted">Check NEXT_PUBLIC_BTAB_PUBLISHABLE_KEY in .env.local, then restart npm run dev.</p>
      </div>
    );
  }
}
