import Image from 'next/image';
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
              {p.image_url ? (
                <Image src={p.image_url} alt={p.name} width={480} height={480} sizes="(max-width: 720px) 100vw, 260px" />
              ) : (
                <div className="noimg" />
              )}
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
        <h1>The shop is not available right now</h1>
        <p>Please try again soon.</p>
        {process.env.NODE_ENV !== 'production' ? (
          <p className="error">
            {err ? `${err.code}: ${err.friendly}` : String(e)} — check .env.local, then restart npm run dev.
          </p>
        ) : null}
      </div>
    );
  }
}
