'use client';

import type { ReactNode } from 'react';
import { Button, GrammarRoot, TextAction } from '@starci/grammar/common';

type SiteShellProps = {
  /** Origin of the shop app this site hands visitors off to; resolved server-side from the projection. */
  readonly shopUrl: string;
  readonly children: ReactNode;
};

/**
 * The document chrome every landing route mounts under: Grammar's Common boundary carrying the
 * brand's light theme, the top bar with the wordmark and section links, then the footer that repeats
 * the hand-off to the shop so it is reachable from the foot of any page. Client because Grammar's
 * Common root pulls in vendor client behavior a Server Component cannot import; `shopUrl` arrives
 * as a prop from the server layout, which is the only place config is read.
 */
export const SiteShell = ({ shopUrl, children }: SiteShellProps) => (
  <GrammarRoot theme="light" className="flex min-h-screen flex-col bg-white text-neutral-900">
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-5">
        <a href="/" className="text-lg font-bold tracking-tight text-neutral-900 no-underline">
          Northwind Supply
        </a>
        <nav className="flex items-center gap-5 text-sm" aria-label="Site">
          <TextAction href="/#catalogue" appearance="muted">
            Catalogue
          </TextAction>
          <TextAction href="/#about" appearance="muted">
            About
          </TextAction>
          <Button href={shopUrl} variant="primary" size="sm">
            Enter shop
          </Button>
        </nav>
      </div>
    </header>
    <main className="flex-1">{children}</main>
    <footer className="mt-auto border-t border-neutral-200 text-sm text-neutral-500">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-5">
        <span>Northwind Supply — everyday objects, built to be kept.</span>
        <TextAction href={shopUrl} appearance="route">
          Shop the full catalogue →
        </TextAction>
      </div>
    </footer>
  </GrammarRoot>
);
