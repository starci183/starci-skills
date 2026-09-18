import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { AppNav } from '../components/AppNav';

type RootLayoutProps = { readonly children: ReactNode };

export const metadata: Metadata = {
  title: 'Northwind Shop',
  description: 'Browse the catalogue, manage your cart and review your orders.',
};

/** The authenticated-app shell: a top bar with the section nav, then the routed page body beneath it. */
const RootLayout = ({ children }: RootLayoutProps) => (
  <html lang="en">
    <body>
      <div className="app">
        <header className="topbar">
          <div className="topbar-inner">
            <a className="brand" href="/browse">Northwind Shop</a>
            <AppNav />
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </body>
  </html>
);

export default RootLayout;
