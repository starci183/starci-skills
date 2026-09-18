'use client';

import { Button, Heading, PageContainer, SectionHeader, SurfaceCard, Text } from '@starci/grammar/common';
import { DuckMascot } from './DuckMascot';
import { ProductCard } from './ProductCard';
import type { Product } from '../data/catalog';

type LandingViewProps = {
  readonly teaser: ReadonlyArray<Product>;
  readonly shopUrl: string;
};

const PILLARS: ReadonlyArray<{ readonly title: string; readonly copy: string }> = [
  {
    title: 'Repairable by design',
    copy: 'Every item ships with the parts and the manual to fix it.',
  },
  {
    title: 'One price, no games',
    copy: 'The number you see is the number you pay — no timers, no dark patterns.',
  },
  {
    title: 'Carbon-neutral delivery',
    copy: 'Offset on every parcel, measured and reported each quarter.',
  },
];

/**
 * The whole public storefront: a welcome hero (the mascot's `mayAppearIn` welcome surface), the
 * curated teaser grid, and the "why Northwind" pillars. Everything below the header is composition -
 * each region maps to a grammar primitive or stays an app-owned layout, per the anatomy contract.
 */
export const LandingView = ({ teaser, shopUrl }: LandingViewProps) => (
  <PageContainer measure="product" className="pb-20">
    <section className="flex flex-col items-center gap-6 pb-16 pt-20 text-center">
      <DuckMascot className="h-24 w-24" aria-hidden />
      <Heading level={1} scale="display">
        Everyday objects, built to be kept.
      </Heading>
      <div className="max-w-xl">
        <Text size="md" tone="muted">
          Northwind Supply makes a small, opinionated catalogue: things you reach for daily and
          expect to still have in ten years. No endless scroll, no filler.
        </Text>
      </div>
      <div className="mt-2 flex gap-3">
        <Button href={shopUrl} variant="primary" size="lg">
          Start shopping
        </Button>
        <Button href="#catalogue" variant="secondary" size="lg">
          See the picks
        </Button>
      </div>
    </section>

    <section id="catalogue" className="pb-16" aria-labelledby="catalogue-heading">
      <SectionHeader
        id="catalogue-heading"
        title="This season’s picks"
        description="A curated slice of the catalogue - the full feed lives in the shop."
        action={
          <Button href={shopUrl} variant="outline" size="sm">
            View the full catalogue →
          </Button>
        }
        level={2}
      />
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {teaser.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>

    <section id="about" aria-labelledby="about-heading">
      <SectionHeader id="about-heading" title="Why Northwind" level={2} />
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {PILLARS.map((pillar) => (
          <SurfaceCard key={pillar.title} label={pillar.title} height="fill">
            <Text size="sm" tone="muted">
              {pillar.copy}
            </Text>
          </SurfaceCard>
        ))}
      </div>
    </section>
  </PageContainer>
);
