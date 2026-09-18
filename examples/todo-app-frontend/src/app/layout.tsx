import type { ReactNode } from 'react';
import './globals.css';

type RootLayoutProps = { readonly children: ReactNode };

/** The document-level title Next reads for every route under this layout. */
export const metadata = {
  title: 'Todo app',
};

/**
 * The one HTML/body shell every route mounts under.
 *
 * This adapter stays a Server Component so it can export `metadata`, and a Next app adapter may
 * import internal project code only through a registered feature public entry - so Grammar's own
 * Common boundary (`GrammarRoot`) is mounted inside each feature entry instead of here; see
 * `src/features/pages/sign-in` and `src/features/pages/tasks`.
 */
const RootLayout = ({ children }: RootLayoutProps) => {
  return (
    <html lang="en">
      <body className="bg-background text-foreground">{children}</body>
    </html>
  );
};

export default RootLayout;
