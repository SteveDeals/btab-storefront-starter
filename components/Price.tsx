import { money, type ProductCard } from '@/lib/btab';

export default function Price({ p }: { p: Pick<ProductCard, 'retail_price_cents' | 'sale' | 'price_range'> }) {
  const from = p.price_range && p.price_range.min_cents !== p.price_range.max_cents;
  return (
    <span className="price">
      {from ? 'From ' : ''}
      {money(from ? p.price_range!.min_cents : p.retail_price_cents)}
      {p.sale ? <span className="was">{money(p.sale.was_cents)}</span> : null}
    </span>
  );
}
