import { sql } from "@modules/platform/database"

/** Recomputes from the source facts in the same connection; replay produces the same row. */
export const RECOMPUTE_ORDER_SUMMARY = sql`INSERT INTO public.order_summary (buyer_id, order_count)
SELECT $1::uuid, count(*)::integer FROM public.orders WHERE buyer_id = $1::uuid
ON CONFLICT (buyer_id) DO UPDATE SET order_count = EXCLUDED.order_count`
export const GET_ORDER_SUMMARY = sql`SELECT buyer_id, order_count FROM public.order_summary WHERE buyer_id = $1::uuid`
