import { CombinedGraphQLErrors, CombinedProtocolErrors } from "@apollo/client"
import { ErrorLink } from "@apollo/client/link/error"

/**
 * Reports what came back from downstream when `debug` is on. The operation maps every error to its GraphQLResponse, so
 * this link never swallows or rewrites one.
 */
export const createErrorLink = (debug = false) =>
    new ErrorLink(({ error, operation }) => {
        if (!debug) return
        if (CombinedGraphQLErrors.is(error)) {
            const codes = error.errors.map((each) => String(each.extensions?.code ?? each.message))
            console.warn(`[graphql] ${operation.operationName}: ${codes.join(", ")}`)
            return
        }
        if (CombinedProtocolErrors.is(error)) {
            console.warn(`[graphql protocol] ${operation.operationName}: ${error.message}`)
            return
        }
        console.warn(`[graphql network] ${operation.operationName}: ${error.message}`)
    })
