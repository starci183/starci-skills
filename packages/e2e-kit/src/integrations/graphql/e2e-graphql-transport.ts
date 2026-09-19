import {
    ApolloClient, HttpLink, InMemoryCache 
} from "@apollo/client"
import {
    DocumentNode, parse 
} from "graphql"
import {
    GraphqlCallOptions, GraphqlErrorObserved, GraphqlObserved 
} from "./graphql-envelope"

/** Per-client options a spec passes to the transport's client() - today just the session bearer. */
export interface E2EGraphqlClientOptions {
  /** Bearer session token folded into every operation this client sends. */
  readonly bearerToken?: string;
}

/** The per-door GraphQL handle a spec drives: real Apollo calls against one /graphql endpoint. */
export interface E2EGraphqlClient {
  readonly baseUrl: string;
  query<TData = Record<string, unknown>>(document: DocumentNode | string, options?: GraphqlCallOptions): Promise<GraphqlObserved<TData>>;
  mutate<TData = Record<string, unknown>>(document: DocumentNode | string, options?: GraphqlCallOptions): Promise<GraphqlObserved<TData>>;
}

/**
 * The once-per-app wiring a transport needs: the frozen document registry a spec may name
 * instead of a raw document string. Each app owns its registry; the transport only resolves.
 */
export interface E2EGraphqlTransportOptions {
  readonly documents?: Record<string, string>;
}

/**
 * What the transport hands an app service: cached raw Apollo clients per (door, bearer) for
 * callers that drive Apollo directly, bound E2EGraphqlClient handles for specs, and the
 * envelope-producing call both are built on.
 */
export interface E2EGraphqlTransport {
  apollo(baseUrl: string, token?: string): ApolloClient;
  client(baseUrl: string, options?: E2EGraphqlClientOptions): E2EGraphqlClient;
  call<TData = Record<string, unknown>>(
    baseUrl: string,
    kind: "query" | "mutate",
    document: DocumentNode | string,
    options?: GraphqlCallOptions,
  ): Promise<GraphqlObserved<TData>>;
}

/**
 * The Apollo-side counterpart of the axios door client: one ApolloClient per (baseUrl,
 * bearer) pair - cached, so a spec reusing a token reuses the client's connection state -
 * pointed at the run-owned api's /graphql endpoint. `query`/`mutate` take a DocumentNode, a
 * registry key or a raw document string and answer with the same GraphqlObserved envelope
 * the HTTP door produces, so refusals stay assertions rather than thrown exceptions.
 */
export function createE2EGraphqlTransport(options: E2EGraphqlTransportOptions = {
}): E2EGraphqlTransport {
    const clients = new Map<string, ApolloClient>()
    const documents = options.documents ?? {
    }

    const apollo = (baseUrl: string, token?: string): ApolloClient => {
        const key = `${baseUrl}\n${token ?? ""}`
        let client = clients.get(key)
        if (!client) {
            client = new ApolloClient({
                cache: new InMemoryCache(),
                link: new HttpLink({
                    uri: `${baseUrl}/graphql`,
                    fetch,
                    headers: token ? {
                        authorization: `Bearer ${token}` 
                    } : undefined,
                }),
                defaultOptions: {
                    // e2e reads must observe what the door answered just now, never a warmed cache.
                    watchQuery: {
                        fetchPolicy: "network-only" 
                    },
                    query: {
                        fetchPolicy: "network-only" 
                    },
                },
            })
            clients.set(key,
                client)
        }
        return client
    }

    const call = async <TData>(
        baseUrl: string,
        kind: "query" | "mutate",
        document: DocumentNode | string,
        callOptions: GraphqlCallOptions = {
        },
    ): Promise<GraphqlObserved<TData>> => {
        const startedAt = Date.now()
        const node = toDocumentNode(document,
            documents)
        try {
            const client = apollo(baseUrl,
                callOptions.token)
            const result = (
        kind === "mutate"
            ? await client.mutate({
                mutation: node,
                variables: callOptions.variables ?? {
                },
                errorPolicy: "all",
            })
            : await client.query({
                query: node,
                variables: callOptions.variables ?? {
                },
                fetchPolicy: "network-only",
                errorPolicy: "all",
            })
      ) as ApolloCallResult
            const errors = formattedErrorsOf(result)
            const firstExtensions = (errors?.[0]?.extensions ?? {
            }) as Record<string, unknown>
            return {
                httpStatus: 200,
                data: (result.data == null ? null : stripTypename(result.data)) as TData | null,
                errors,
                errorCode: (firstExtensions.code as string) ?? null,
                errorMessage: (errors?.[0]?.message as string) ?? null,
                raw: result,
                durationMs: Date.now() - startedAt,
            }
        } catch (error) {
            // Transport-level failure (api down, abort, unparseable response): same envelope, status 0.
            return {
                httpStatus: 0,
                data: null,
                errors: null,
                errorCode: "NETWORK_ERROR",
                errorMessage: error instanceof Error ? error.message : String(error),
                raw: error,
                durationMs: Date.now() - startedAt,
            }
        }
    }

    const client = (baseUrl: string, clientOptions: E2EGraphqlClientOptions = {
    }): E2EGraphqlClient => ({
        baseUrl,
        query: <TData>(document: DocumentNode | string,
            callOptions: GraphqlCallOptions = {
            }) => call<TData>(baseUrl,
                "query",
                document,
                {
                    ...callOptions, token: callOptions.token ?? clientOptions.bearerToken 
                }),
        mutate: <TData>(document: DocumentNode | string,
            callOptions: GraphqlCallOptions = {
            }) => call<TData>(baseUrl,
                "mutate",
                document,
                {
                    ...callOptions, token: callOptions.token ?? clientOptions.bearerToken 
                }),
    })

    return {
        apollo, client, call 
    }
}

/** A registry key resolves through the app's document map; a raw string parses as itself. */
function toDocumentNode(document: DocumentNode | string, documents: Record<string, string>): DocumentNode {
    if (typeof document !== "string") return document
    return parse(documents[document] ?? document)
}

/** One ApolloClient operation's raw result across the shapes AC4 and older clients answer in. */
interface ApolloCallResult {
  data?: unknown;
  error?: unknown;
  errors?: unknown;
}

/** GraphQL refusals arrive as a CombinedGraphQLErrors on `.error`; older shapes used `.errors`. */
function formattedErrorsOf(result: ApolloCallResult): Array<GraphqlErrorObserved> | null {
    const combined = (result.error as { errors?: unknown } | undefined)?.errors
    if (Array.isArray(combined) && combined.length) return combined as Array<GraphqlErrorObserved>
    if (Array.isArray(result.errors) && result.errors.length) return result.errors as Array<GraphqlErrorObserved>
    if (result.error) {
        const message = (result.error as { message?: string }).message ?? String(result.error)
        return [{
            message 
        }]
    }
    return null
}

/**
 * Apollo's cache injects `__typename` into every selection set; it is client bookkeeping,
 * not the door's contract, so the observed data a spec asserts on drops it (deep, arrays too).
 */
function stripTypename(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(stripTypename)
    if (value !== null && typeof value === "object") {
        const clean: Record<string, unknown> = {
        }
        for (const [key,
            field] of Object.entries(value)) {
            if (key !== "__typename") clean[key] = stripTypename(field)
        }
        return clean
    }
    return value
}
