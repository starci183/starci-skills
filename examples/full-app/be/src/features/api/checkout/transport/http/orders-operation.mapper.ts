import type { ListOrdersResult, OPERATIONS } from "@modules/domain/order"
import type { OperationReply, OperationRequest } from "@modules/platform/operations"

/** The answer of the operation route: the request's operation and id, and the outcome the query produced. */
export const toOperationReply = (
    request: OperationRequest<typeof OPERATIONS>,
    outcome: ListOrdersResult,
): OperationReply<typeof OPERATIONS> => ({
    operation: request.operation,
    requestId: request.requestId,
    outcome,
})
