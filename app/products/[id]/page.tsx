/* eslint-disable @next/next/no-img-element -- photos come from /photo/<token> on this shop's own address */
import { notFound } from 'next/navigation';
import { btab, BtabError } from '@/lib/btab';
import { photoUrl } from '@/lib/photo';
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
  const image = photoUrl(product.images[0]?.url || product.image_url);
  return (
    <div className="pdp">
      <div>{image ? (
          <img className="main" src={image} alt={product.images[0]?.alt || product.name} width={800} height={800} />
        ) : null}</div>
      <div>
        <h1>{product.name}</h1>
        <p>
          <Price p={product} />
          <StockTag p={product} />
        </p>
        {product.description ? <p className="muted">{product.description.replace(/<[^>]+>/g, ' ')}</p> : null}
        <AddToCart
          product={{
            id: product.id,
            enquiry_only: product.enquiry_only,
            in_stock: product.in_stock,
            options: product.options,
            variants: product.variants.map((v) => ({ id: v.id, available_for_sale: v.available_for_sale, selected_options: v.selected_options })),
          }}
        />
      </div>
    </div>
  );
}
