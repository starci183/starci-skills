'use client';

import { SurfaceCard, Text } from '@starci/grammar/common';
import { formatPrice, type Product } from '../data/catalog';

type ProductCardProps = {
  readonly product: Product;
};

/**
 * One catalogue teaser tile: the grammar `SurfaceCard` carries the name in its label and the price
 * as the label-row fact, the app-owned glyph stands in for product photography so the page ships no
 * broken or invented image URL. `height="fill"` lets a grid row stretch every card evenly.
 */
export const ProductCard = ({ product }: ProductCardProps) => (
  <SurfaceCard
    label={product.name}
    fact={formatPrice(product.priceCents, product.currency)}
    height="fill"
  >
    <div
      aria-hidden="true"
      className="brand-primary-tint grid aspect-[4/3] place-items-center rounded-xl text-5xl"
    >
      {product.glyph}
    </div>
    <Text size="sm" tone="muted">
      {product.blurb}
    </Text>
  </SurfaceCard>
);
