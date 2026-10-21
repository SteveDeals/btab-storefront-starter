import { buyState, type ProductCard } from '@/lib/btab';

export default function StockTag({ p }: { p: Pick<ProductCard, 'enquiry_only' | 'in_stock'> }) {
  const s = buyState(p);
  if (s === 'enquire') return <span className="tag">Enquire</span>;
  if (s === 'sold_out') return <span className="tag bad">Sold out</span>;
  return null;
}
