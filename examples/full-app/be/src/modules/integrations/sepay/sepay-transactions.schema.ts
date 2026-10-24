import { z } from "zod"

/** The most transactions one page of the SePay list API carries; a longer answer is refused whole. */
export const SEPAY_PAGE_MAX = 100

/** One bank transaction of the SePay list API, as far as this app reads it. */
export const SepayTransactionSchema = z.object({
    id: z.string().max(32),
    transaction_date: z.string().max(32),
    amount_in: z.string().max(32),
    transaction_content: z.string().max(500),
    reference_number: z.string().max(64).nullable(),
})

/** The answer of the SePay transaction list API: a status, then one bounded page. */
export const SepayTransactionsSchema = z.object({
    status: z.number().int(),
    transactions: z.array(SepayTransactionSchema).max(SEPAY_PAGE_MAX),
})

/** One validated SePay transaction. */
export type SepayTransaction = z.infer<typeof SepayTransactionSchema>
