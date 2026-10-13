import type { ApolloServerPlugin } from "@apollo/server"
import type { GraphQLFormattedError } from "graphql"
import type { ErrorParams, ErrorsService } from "@modules/platform/errors"
import type { Locale, RequestLocale } from "@modules/platform/i18n"
import type { GraphqlContext } from "./graphql.contracts"

/** The interpolation params of an error: the string and number entries of its `extensions.params` record. */
const paramsOf = (value: unknown): ErrorParams => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return {}
    const params: Record<string, string | number> = {}
    for (const [key, entry] of Object.entries(value)) {
        if (typeof entry === "string" || typeof entry === "number") params[key] = entry
    }
    return params
}

/** The language a request asks for: the `x-locale` header the front end's locale link writes, else Accept-Language. */
const requestedLocale = (context: GraphqlContext): string | undefined => {
    const declared = context.req.headers["x-locale"]
    return typeof declared === "string" && declared !== "" ? declared : context.req.headers["accept-language"]
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

/** An Apollo plugin that localizes every coded error of a response in the language of the request. */
export const localizeErrorsPlugin = (
    errors: ErrorsService,
    requestLocale: RequestLocale,
): ApolloServerPlugin<GraphqlContext> => ({
    requestDidStart: () =>
        Promise.resolve({
            willSendResponse: ({ contextValue, response }) => {
                if (response.body.kind === "single" && response.body.singleResult.errors) {
                    const locale = requestLocale.of(requestedLocale(contextValue))
                    response.body.singleResult.errors = response.body.singleResult.errors.map((error) =>
                        localizeError(errors, locale, error),
                    )
                }
                return Promise.resolve()
            },
        }),
})
