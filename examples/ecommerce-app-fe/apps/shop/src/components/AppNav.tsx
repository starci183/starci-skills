'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS: ReadonlyArray<{ readonly href: string; readonly label: string }> = [
  { href: '/browse', label: 'Browse' },
  { href: '/cart', label: 'Cart' },
  { href: '/checkout', label: 'Checkout' },
  { href: '/account', label: 'Account' },
];

/**
 * The primary navigation of the shop shell. Client so it can mark the active route from the current path —
 * the only interactivity the skeleton needs; every page beneath it stays a Server Component.
 */
export const AppNav = () => {
  const pathname = usePathname();

  return (
    <nav className="nav" aria-label="Shop">
      {LINKS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={pathname === href || pathname.startsWith(`${href}/`) ? 'active' : undefined}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
};
