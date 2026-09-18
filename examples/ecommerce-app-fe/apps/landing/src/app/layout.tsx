import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { SiteFooter } from '../components/SiteFooter';
import { SiteHeader } from '../components/SiteHeader';

type RootLayoutProps = { readonly children: ReactNode };

export const metadata: Metadata = {
  title: 'Northwind Supply — everyday objects, built to be kept',
  description: 'The public storefront for Northwind Supply. Browse the catalogue, then continue to the shop.',
};

/** The document shell every landing route mounts under: header, page body, footer. */
const RootLayout = ({ children }: RootLayoutProps) => (
  <html lang="en">
    <body>
      <div className="page">
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </div>
    </body>
  </html>
);

export default RootLayout;
