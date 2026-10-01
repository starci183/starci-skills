import { GraphQLError } from "graphql"
import type { GraphQLFormattedError } from "graphql"
import type { ErrorDescription, ErrorDescriber } from "./errors.contracts"

const describeGraphqlFailure = (errors: ErrorDescriber, error: unknown): ErrorDescription => {
    if (error instanceof GraphQLError) {
        return error.originalError ? errors.describe(error.originalError) : errors.describeInvalidOperation()
    }
    return errors.describe(error)
}

/**
 * The one GraphQL error formatter: a failure thrown by a resolver becomes `errors[].extensions.{code,kind,params}`;
 * a malformed operation (no original error) is `invalid`; anything else is masked. The message is the code until the
 * response plugin localizes it.
 */
export const formatGraphqlError = (
    errors: ErrorDescriber,
    formatted: GraphQLFormattedError,
    error: unknown,
): GraphQLFormattedError => {
    const description = describeGraphqlFailure(errors, error)
    return {
        message: description.code,
        locations: formatted.locations,
        path: formatted.path,
        extensions: { code: description.code, kind: description.kind, params: description.params },
    }
}
