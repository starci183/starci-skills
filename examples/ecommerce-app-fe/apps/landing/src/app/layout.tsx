import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@fontsource-variable/inter';
import './globals.css';
import { SiteShell } from '../components/SiteShell';
import { SHOP_URL } from '../modules/config';

type RootLayoutProps = { readonly children: ReactNode };

export const metadata: Metadata = {
  title: 'Northwind Supply — everyday objects, built to be kept',
  description: 'The public storefront for Northwind Supply. Browse the catalogue, then continue to the shop.',
};

/**
 * The document shell every landing route mounts under. It stays a Server Component so it can export
 * `metadata`, and it is the one place the shop hand-off origin is read from config - Grammar's
 * Common root and the page chrome live in `SiteShell`, a client boundary, and take the resolved URL
 * as a prop.
 */
const RootLayout = ({ children }: RootLayoutProps) => (
  <html lang="en">
    <body>
      <SiteShell shopUrl={SHOP_URL}>{children}</SiteShell>
    </body>
  </html>
);

export default RootLayout;
