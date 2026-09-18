'use client';

import { MediaFrame, SurfaceCard, Text } from '@starci/grammar/common';
import { formatPrice } from '../modules/money';
import type { Product } from '../modules/api/catalog';

type ProductTileProps = {
  readonly product: Product;
};

/**
 * A browse catalogue tile: the grammar `SurfaceCard` carries the name in its label and the price as
 * the label-row fact. A service-provided `imageUrl` renders through `MediaFrame`; rows without one
 * get a neutral initial-letter tile, so the grid ships no broken or fabricated image URL.
 */
export const ProductTile = ({ product }: ProductTileProps) => (
  <SurfaceCard
    label={product.name}
    fact={formatPrice(product.priceCents, product.currency)}
    height="fill"
  >
    {product.imageUrl ? (
      <MediaFrame aspect="landscape" fit="cover">
        {/* eslint-disable-next-line @next/next/no-img-element -- the service owns the URL; next/image has no remote pattern for it yet */}
        <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
      </MediaFrame>
    ) : (
      <div
        aria-hidden="true"
        className="brand-primary-tint grid aspect-[4/3] place-items-center rounded-xl text-4xl font-semibold"
      >
        {product.name.slice(0, 1).toUpperCase()}
      </div>
    )}
    {product.blurb ? (
      <Text size="sm" tone="muted">
        {product.blurb}
      </Text>
    ) : null}
  </SurfaceCard>
);
