import Image from 'next/image';
import { notFound } from 'next/navigation';
import { btab, BtabError } from '@/lib/btab';
import Price from '@/components/Price';
import StockTag from '@/components/StockTag';
import AddToCart from '@/components/AddToCart';

export const dynamic = 'force-dynamic';

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let product;
  try {
    product = await btab({ revalidateSeconds: 60 }).getProduct(id);
  } catch (e) {
    if (e instanceof BtabError && e.status === 404) notFound();
    throw e;
  }
  const image = product.images[0]?.url || product.image_url;
  return (
    <div className="pdp">
      <div>{image ? (
          <Image className="main" src={image} alt={product.images[0]?.alt || product.name} width={800} height={800} sizes="(max-width: 720px) 100vw, 520px" priority />
        ) : null}</div>
      <div>
        <h1>{product.name}</h1>
        <p>
          <Price p={product} />
          <StockTag p={product} />
        </p>
        {product.description ? <p className="muted">{product.description.replace(/<[^>]+>/g, ' ')}</p> : null}
        <AddToCart product={product} />
      </div>
    </div>
  );
}
