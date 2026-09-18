'use client';

import type { ReactNode } from 'react';
import { GrammarRoot } from '@starci/grammar/common';
import { AppNav } from './AppNav';

type ShopShellProps = {
  readonly children: ReactNode;
};

/**
 * The authenticated-app chrome: Grammar's Common boundary carrying the brand's light theme, the top
 * bar with the wordmark and the section nav, then the routed page body. Client because Grammar's
 * Common root pulls in vendor client behavior a Server Component cannot import - the same boundary
 * shape todo-app-frontend's feature entries use.
 */
export const ShopShell = ({ children }: ShopShellProps) => (
  <GrammarRoot theme="light" className="flex min-h-screen flex-col bg-neutral-50 text-neutral-900">
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-5">
        <a href="/browse" className="whitespace-nowrap text-base font-bold tracking-tight text-neutral-900 no-underline">
          Northwind Shop
        </a>
        <AppNav />
      </div>
    </header>
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-7 pb-16">{children}</main>
  </GrammarRoot>
);
