import { ORDER_API_URL } from '../config';
import { getJson, unwrapItems, type CollectionResponse } from './http';
import type { Result } from './result';

export type OrderLine = {
  readonly productId: string;
  readonly name: string;
  readonly quantity: number;
  readonly unitPriceCents: number;
};

export type Order = {
  readonly id: string;
  readonly status: 'open' | 'paid' | 'shipped' | 'cancelled';
  readonly currency: string;
  readonly totalCents: number;
  readonly lines: ReadonlyArray<OrderLine>;
};

/**
 * Read the shopper's orders for the account view.
 *
 * contract: which customer's orders to return is a session question, not a request-body one. Today the
 * backend lane owns no session handoff into the shop yet (see `identity.ts`), so this reads the
 * service-wide `/orders` list; it becomes `/orders` scoped to the signed-in customer the moment the handoff
 * is settled. Until then a reachable service is still rendered honestly, and an unreachable one is empty.
 */
export const fetchOrders = async (): Promise<Result<ReadonlyArray<Order>>> => {
  const result = await getJson<CollectionResponse<Order>>(`${ORDER_API_URL}/orders`);
  if (!result.ok) return result;
  return { ok: true, data: unwrapItems(result.data) };
};
