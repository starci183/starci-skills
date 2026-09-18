'use client';

import { usePathname } from 'next/navigation';
import { TextAction } from '@starci/grammar/common';

const LINKS: ReadonlyArray<{ readonly href: string; readonly label: string }> = [
  { href: '/browse', label: 'Browse' },
  { href: '/cart', label: 'Cart' },
  { href: '/checkout', label: 'Checkout' },
  { href: '/account', label: 'Account' },
];

/**
 * The primary navigation of the shop shell. Client so it can mark the active route from the current
 * path (`isCurrent` is TextAction's real current-marker) - the only interactivity the shell needs;
 * every page beneath it stays a Server Component until it mounts a grammar view.
 */
export const AppNav = () => {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 overflow-x-auto text-sm" aria-label="Shop">
      {LINKS.map(({ href, label }) => (
        <TextAction
          key={href}
          href={href}
          appearance="route"
          isCurrent={pathname === href || pathname.startsWith(`${href}/`)}
        >
          {label}
        </TextAction>
      ))}
    </nav>
  );
};
