import { SepayError, SepayErrorCode } from "./errors/sepay.error"
import { SepayTransactionsSchema } from "./sepay-transactions.schema"
import type { SepayTransaction } from "./sepay-transactions.schema"

/** The transactions of a SePay list answer; an answer outside the schema is refused whole, never partly trusted. */
export const readSepayTransactions = (body: unknown): ReadonlyArray<SepayTransaction> => {
    const answer = SepayTransactionsSchema.safeParse(body)
    if (!answer.success) throw new SepayError({ code: SepayErrorCode.MalformedResponse, cause: answer.error })
    return answer.data.transactions
}
