import type { ReactNode } from 'react';
import './globals.css';

type RootLayoutProps = { readonly children: ReactNode };

/** The document-level title Next reads for every route under this layout. */
export const metadata = {
  title: 'Todo app',
};

/** The one HTML/body shell every route mounts under. */
const RootLayout = ({ children }: RootLayoutProps) => {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
};

export default RootLayout;
