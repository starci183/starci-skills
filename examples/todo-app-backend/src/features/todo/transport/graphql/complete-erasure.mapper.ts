import type { CompleteErasureRequest, CompletedErasure } from "../../application/complete-erasure.contracts"
import type { CompleteErasureInput } from "./dto/complete-erasure.input"
import type { CompleteErasureType } from "./dto/complete-erasure.type"

/** Maps the GraphQL input to the command request. */
export const toCompleteErasureRequest = (input: CompleteErasureInput): CompleteErasureRequest => ({
    requestId: input.requestId,
})

/** Maps the completed request to the GraphQL type. */
export const toCompleteErasureType = (completed: CompletedErasure): CompleteErasureType => ({
    requestId: completed.requestId,
    state: completed.state,
})
