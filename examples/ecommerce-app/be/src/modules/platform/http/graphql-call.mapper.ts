import { isRecord } from "@modules/platform/primitives"
import type { HttpClient } from "./http.port"

/** One GraphQL operation sent to another service. */
export interface GraphqlCall {
    /** The GraphQL endpoint URL. */
    readonly url: string
    /** The operation text. */
    readonly query: string
    /** The operation variables. */
    readonly variables?: Readonly<Record<string, unknown>>
    /** Extra request headers, such as the bearer token to forward. */
    readonly headers?: Readonly<Record<string, string>>
    /** How long to wait for the answer. */
    readonly timeoutMs: number
}

/** What a GraphQL service answered: the data object and the codes of the errors it reported. */
export interface GraphqlAnswer {
    /** The `data` object, undefined when the operation failed before producing one. */
    readonly data: Readonly<Record<string, unknown>> | undefined
    /** The `extensions.code` of every reported error. */
    readonly errorCodes: ReadonlyArray<string>
}

/** What a GraphQL call yields: the answer, or null when the body is not a GraphQL response at all. */
export type GraphqlCallResult = GraphqlAnswer | null

const codesOf = (errors: unknown): Array<string> =>
    Array.isArray(errors)
        ? errors.flatMap((error): Array<string> => {
              const code: unknown = isRecord(error) && isRecord(error.extensions) ? error.extensions.code : undefined
              return typeof code === "string" ? [code] : []
          })
        : []

/** Sends a GraphQL operation and reads the answer; null when the body is not a GraphQL response at all. */
export const callGraphql = async (http: HttpClient, call: GraphqlCall): Promise<GraphqlCallResult> => {
    const response = await http.request({
        method: "POST",
        url: call.url,
        headers: call.headers,
        body: { query: call.query, variables: call.variables },
        timeoutMs: call.timeoutMs,
    })
    const body = response.body
    if (!isRecord(body)) return null
    return { data: isRecord(body.data) ? body.data : undefined, errorCodes: codesOf(body.errors) }
}
