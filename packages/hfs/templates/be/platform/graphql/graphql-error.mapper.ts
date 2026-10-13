import { GraphQLError } from "graphql"
import type { GraphQLFormattedError } from "graphql"
import type { ErrorsService } from "@modules/platform/errors"

/**
 * The one GraphQL error formatter: a failure thrown by a resolver or a guard becomes `errors[].extensions.{code,kind,params}`
 * through the errors service (a declared code keeps its code, anything else is masked as internal); a malformed operation
 * (syntax or validation, no original error) keeps its message with kind `invalid`. The message of a coded error is the code
 * until the localize plugin replaces it with the catalog text.
 */
export const formatGraphqlError = (
    errors: ErrorsService,
    formatted: GraphQLFormattedError,
    error: unknown,
): GraphQLFormattedError => {
    if (error instanceof GraphQLError && error.originalError === undefined) {
        return {
            message: formatted.message,
            locations: formatted.locations,
            path: formatted.path,
            extensions: { kind: "invalid" },
        }
    }
    const description = errors.describe(error instanceof GraphQLError ? error.originalError : error)
    return {
        message: description.code,
        locations: formatted.locations,
        path: formatted.path,
        extensions: { code: description.code, kind: description.kind, params: description.params },
    }
}
