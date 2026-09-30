import type { ErasureReceipt } from "../../application/request-erasure.contracts"
import type { RequestErasureType } from "./dto/request-erasure.type"

/** Maps the opened request to the GraphQL type. */
export const toRequestErasureType = (receipt: ErasureReceipt): RequestErasureType => ({
    requestId: receipt.requestId,
    state: receipt.state,
})
