import type { ApolloServerPlugin } from "@apollo/server"
import type { GraphQLFormattedError } from "graphql"
import type { ErrorParams, ErrorsService } from "@modules/platform/errors"
import type { Locale, RequestLocale } from "@modules/platform/i18n"
import { isRecord } from "@modules/platform/primitives"
import type { GraphqlContext } from "./graphql.contracts"

const paramsOf = (value: unknown): ErrorParams => {
    if (!isRecord(value)) return {}
    const params: Record<string, string | number> = {}
    for (const [key, entry] of Object.entries(value)) {
        if (typeof entry === "string" || typeof entry === "number") params[key] = entry
    }
    return params
}

/** Replaces the message of an error carrying a code with the catalog text of that code in `locale`; other errors pass unchanged. */
export const localizeError = (
    errors: ErrorsService,
    locale: Locale,
    error: GraphQLFormattedError,
): GraphQLFormattedError => {
    const code = error.extensions?.code
    if (typeof code !== "string") return error
    return { ...error, message: errors.text(code, paramsOf(error.extensions?.params), locale) }
}

/** An Apollo plugin that localizes every error of a response in the locale of the request (the formatter leaves the code as the message). */
export const localizeErrorsPlugin = (
    errors: ErrorsService,
    requestLocale: RequestLocale,
): ApolloServerPlugin<GraphqlContext> => ({
    requestDidStart: () =>
        Promise.resolve({
            willSendResponse: ({ contextValue, response }) => {
                if (response.body.kind === "single" && response.body.singleResult.errors) {
                    const locale = requestLocale.of(contextValue.req.headers["accept-language"])
                    response.body.singleResult.errors = response.body.singleResult.errors.map((error) =>
                        localizeError(errors, locale, error),
                    )
                }
                return Promise.resolve()
            },
        }),
})
