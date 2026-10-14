/** Mirrors public.order_summary, owned by the Supabase migration. */
export interface OrderSummaryRow {
    readonly buyer_id: string
    readonly order_count: number
}
