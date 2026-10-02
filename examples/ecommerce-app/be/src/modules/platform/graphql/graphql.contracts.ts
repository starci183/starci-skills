import type { Request, Response } from "express"
import type { OperationRequest } from "@modules/platform/http-security"

/** The GraphQL context every operation runs with: the request it arrived on and, over HTTP, its response. */
export interface GraphqlContext {
    /** The request: the HTTP request, or the one built from a subscription connection. */
    readonly req: OperationRequest
    /** The HTTP response; a subscription has none. */
    readonly res: Response | undefined
}

/** What the driver hands the context function: the HTTP pair, or the connection extras of a subscription. */
export interface GraphqlContextInput {
    /** The HTTP request (absent on a subscription connection). */
    readonly req?: Request
    /** The HTTP response (absent on a subscription connection). */
    readonly res?: Response
    /** The connection extras the subscription server kept for this connection. */
    readonly extra?: ConnectionExtra
}

/** The request headers of an upgrade request: any header by name, the Authorization one typed. */
export interface ConnectionHeaders {
    readonly [name: string]: string | ReadonlyArray<string> | undefined
    readonly authorization?: string
}

/** The socket an upgrade request came in on. */
export interface ConnectionSocket {
    /** The address of the peer. */
    readonly remoteAddress?: string
}

/** What the connection handler of the subscription server receives when a client initialises: its params and its extras. */
export interface SubscriptionConnection {
    /** The params the client sent when it initialised the connection. */
    readonly connectionParams?: Readonly<Record<string, unknown>>
    /** The extras the server keeps for the connection, unchecked. */
    readonly extra: unknown
}

/** What the app reads of the upgrade request of a subscription connection. */
export interface ConnectionRequest {
    /** The request headers. */
    readonly headers: ConnectionHeaders
    /** The socket the connection came in on. */
    readonly socket: ConnectionSocket
}

/** What a subscription connection keeps for its operations: its upgrade request and the Authorization the client sent as a connection param. */
export interface ConnectionExtra {
    /** The HTTP upgrade request of the connection: its headers and the address it came from. */
    readonly request: ConnectionRequest
    /** The `authorization` connection param, set when the connection is initialised. */
    authorization?: string
}

/** The connection params of a subscription client. */
export interface ConnectionParams {
    /** The bearer credential, as an HTTP client would send it in the Authorization header. */
    readonly authorization?: unknown
}

/** The deepest selection nesting an operation may have. */
export const GRAPHQL_DEPTH_MAX = 10
