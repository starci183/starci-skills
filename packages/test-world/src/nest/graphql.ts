import type { GraphqlObserved, GraphqlWire, HttpCaller, TestApi, TestCaller } from "./api"
import { createHttpClient } from "./http-client"

const UNPARSABLE_LIMIT = 2000

/** Folds one GraphQL-over-HTTP response into the observed envelope; a body that is not an object degrades into an `unparsableBody` note. */
export const graphqlEnvelopeOf = <TData>(httpStatus: number, body: GraphqlWire<TData> | string, startedAt: number): GraphqlObserved<TData> => {
    const durationMs = Date.now() - startedAt
    if (typeof body === "string") {
        return { httpStatus, data: null, errors: null, errorCode: null, errorMessage: null, raw: { unparsableBody: body.slice(0, UNPARSABLE_LIMIT) }, durationMs }
    }
    const errors = body.errors ?? null
    const code = errors?.[0]?.extensions?.["code"]
    return {
        httpStatus,
        data: body.data ?? null,
        errors,
        errorCode: typeof code === "string" ? code : null,
        errorMessage: errors?.[0]?.message ?? null,
        raw: body,
        durationMs,
    }
}

/** What binds an app's callers. */
export interface AppApiSpec {
    readonly baseUrl: string
    readonly operations: Readonly<Record<string, string>>
    readonly graphqlPath: string
    readonly signIn: (email: string, password: string) => Promise<{ readonly sessionToken: string; readonly personId: string }>
}

const callerOf = (spec: AppApiSpec, bearerToken?: string): TestCaller => {
    const http: HttpCaller = createHttpClient({ baseUrl: spec.baseUrl, bearerToken })
    const send = async <TData>(operation: string, variables?: Record<string, unknown>, language?: string): Promise<GraphqlObserved<TData>> => {
        const startedAt = Date.now()
        const headers: Record<string, string> = language === undefined ? {} : { "accept-language": language }
        const response = await http.post<GraphqlWire<TData> | string>(
            spec.graphqlPath,
            { query: spec.operations[operation] ?? operation, variables: variables ?? {} },
            { headers },
        )
        return graphqlEnvelopeOf<TData>(response.status, response.body, startedAt)
    }
    return {
        ...http,
        graphql: send,
        read: (operation, options) => send(operation, options?.variables),
        mutate: (operation, options) => send(operation, options?.variables),
    }
}

/** Builds the api client of an app listening at `spec.baseUrl`. */
export const createTestApi = (spec: AppApiSpec): TestApi => ({
    ...callerOf(spec),
    baseUrl: spec.baseUrl,
    as: (token) => callerOf(spec, token),
    bearing: (token) => callerOf(spec, token),
    signIn: (email, password) => spec.signIn(email, password),
})
