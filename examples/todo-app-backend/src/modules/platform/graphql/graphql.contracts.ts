import type { Request, Response } from "express"

/** The GraphQL context every operation runs with: the HTTP request and response it arrived on. */
export interface GraphqlContext {
    /** The HTTP request. */
    readonly req: Request
    /** The HTTP response. */
    readonly res: Response
}

/** The deepest selection nesting an operation may have. */
export const GRAPHQL_DEPTH_MAX = 10
