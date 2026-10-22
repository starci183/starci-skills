import type { Request } from "express"

/**
 * What the guards and the identity decorators read of the request behind an operation. Over HTTP it is the request itself;
 * over a GraphQL subscription connection it is built from the upgrade request and the connection params, because a
 * connection has no per-operation HTTP request.
 */
export type OperationRequest = Pick<Request, "headers" | "method" | "ip" | "principal">
