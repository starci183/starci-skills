import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@fontsource-variable/inter';
import './globals.css';
import { ShopShell } from '../components/ShopShell';

type RootLayoutProps = { readonly children: ReactNode };

export const metadata: Metadata = {
  title: 'Northwind Shop',
  description: 'Browse the catalogue, manage your cart and review your orders.',
};

/**
 * The document shell every shop route mounts under. It stays a Server Component so it can export
 * `metadata`; Grammar's Common root and the app chrome live in `ShopShell`, a client boundary.
 */
const RootLayout = ({ children }: RootLayoutProps) => (
  <html lang="en">
    <body>
      <ShopShell>{children}</ShopShell>
    </body>
  </html>
);

export default RootLayout;
