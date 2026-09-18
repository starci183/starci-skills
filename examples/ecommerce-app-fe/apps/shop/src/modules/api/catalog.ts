import { ORDER_API_URL } from '../config';
import { getJson, unwrapItems, type CollectionResponse } from './http';
import type { Result } from './result';

/**
 * A catalogue row as the `order` service exposes it. `imageUrl` is optional on purpose: the deployed
 * service may not serve imagery yet, and the tile renders a neutral glyph instead of a broken <img>.
 */
export type Product = {
  readonly id: string;
  readonly name: string;
  readonly blurb?: string;
  readonly priceCents: number;
  readonly currency: string;
  readonly imageUrl?: string;
};

/** Read the browse catalogue from the `order` service. A refusal is returned verbatim for the empty state. */
export const fetchProducts = async (): Promise<Result<ReadonlyArray<Product>>> => {
  const result = await getJson<CollectionResponse<Product>>(`${ORDER_API_URL}/products`);
  if (!result.ok) return result;
  return { ok: true, data: unwrapItems(result.data) };
};
