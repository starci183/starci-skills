'use client';

import { SectionHeader } from '@starci/grammar/common';
import { ProductTile } from './ProductTile';
import { StateBlock } from './StateBlock';
import type { Product } from '../modules/api/catalog';
import type { Result } from '../modules/api/result';

type BrowseViewProps = {
  /** The catalogue read, verbatim: the payload, or the reason there is none. */
  readonly result: Result<ReadonlyArray<Product>>;
  /** The resolved order-service origin the read was attempted against. */
  readonly orderApiUrl: string;
};

/**
 * The browse route's whole render. An unreachable service is an error surface (no mascot, per the
 * brand's `neverIn`); a reachable service with zero rows is a genuine empty state and the duck is
 * welcome there.
 */
export const BrowseView = ({ result, orderApiUrl }: BrowseViewProps) => {
  if (!result.ok) {
    return (
      <>
        <SectionHeader title="Browse" description="Everything Northwind stocks." level={1} />
        <StateBlock
          title="No products to show"
          description={`The catalogue is served by the order API at ${orderApiUrl}. It is not reachable right now (${result.reason}). Start the order service, or point NEXT_PUBLIC_ORDER_API_URL at a running one, then reload.`}
        />
      </>
    );
  }

  if (result.data.length === 0) {
    return (
      <>
        <SectionHeader title="Browse" description="Everything Northwind stocks." level={1} />
        <StateBlock
          mascot
          title="The catalogue is empty"
          description="The order service answered, but it has no products yet."
        />
      </>
    );
  }

  return (
    <>
      <SectionHeader
        title="Browse"
        description={`Everything Northwind stocks — ${result.data.length} items.`}
        level={1}
      />
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {result.data.map((product) => (
          <ProductTile key={product.id} product={product} />
        ))}
      </div>
    </>
  );
};
