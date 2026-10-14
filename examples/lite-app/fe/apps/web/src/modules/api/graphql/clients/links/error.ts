import { CombinedGraphQLErrors, CombinedProtocolErrors } from "@apollo/client"
import { ErrorLink } from "@apollo/client/link/error"

/** Where the error link reports one failed operation, as one line (the app's observability, when it wires one). */
export type ErrorReporter = (line: string) => void

/** One GraphQL error as the combined error carries it: its message and its extensions. */
type GraphQLErrorEntry = { readonly message: string; readonly extensions?: Readonly<Record<string, unknown>> }

/** The code of one GraphQL error (`extensions.code`), else its message. */
const codeOf = (error: GraphQLErrorEntry): string =>
    typeof error.extensions?.code === "string" ? error.extensions.code : error.message

/**
 * Reports what came back from downstream to `report` when the app passes one. The operation maps every error to its
 * GraphQLResponse, so this link never swallows or rewrites one.
 */
export const createErrorLink = (report?: ErrorReporter) =>
    new ErrorLink(({ error, operation }) => {
        if (report === undefined) return
        if (CombinedGraphQLErrors.is(error)) {
            report(`[graphql] ${operation.operationName}: ${error.errors.map(codeOf).join(", ")}`)
            return
        }
        if (CombinedProtocolErrors.is(error)) {
            report(`[graphql protocol] ${operation.operationName}: ${error.message}`)
            return
        }
        report(`[graphql network] ${operation.operationName}: ${error.message}`)
    })
