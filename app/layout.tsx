import type { Metadata } from 'next';
import Link from 'next/link';
import CartLink from '@/components/CartLink';
import './globals.css';

const shopName = process.env.NEXT_PUBLIC_SHOP_NAME || 'Starter Shop';

export const metadata: Metadata = {
  title: shopName,
  description: 'A shop on its own domain, built on the btab Storefront API.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU">
      <body>
        <header className="top">
          <div className="wrap">
            <Link href="/" className="brand">
              {shopName}
            </Link>
            <CartLink />
          </div>
        </header>
        <main className="wrap">{children}</main>
      </body>
    </html>
  );
}
