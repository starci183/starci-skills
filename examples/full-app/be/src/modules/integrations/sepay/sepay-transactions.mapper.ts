import { Injectable } from "@nestjs/common"
import { SepayError, SepayErrorCode } from "./errors/sepay.error"
import { SepayTransactionsSchema } from "./sepay-transactions.schema"
import type { SepayTransactionPage } from "./sepay-transactions.schema"

@Injectable()
/** Reads the transactions of a SePay list answer; an answer outside the schema is refused whole, never partly trusted. */
export class SepayTransactionsMapper {
    /** The validated page of an answer body, or a `MalformedResponse` refusal. */
    read(body: unknown): SepayTransactionPage {
        const answer = SepayTransactionsSchema.safeParse(body)
        if (!answer.success) throw new SepayError({ code: SepayErrorCode.MalformedResponse, cause: answer.error })
        return answer.data.transactions
    }
}
