import type { OperationRequest } from "@modules/platform/http-security"
import type { ConnectionExtra, ConnectionParams, GraphqlContext, GraphqlContextInput } from "./graphql.contracts"

/** The request of a subscription operation: the upgrade headers with the Authorization the client sent as a connection param. */
export const connectionRequestOf = (extra: ConnectionExtra | undefined): OperationRequest => ({
    headers: { ...extra?.request.headers, authorization: extra?.authorization ?? extra?.request.headers.authorization },
    method: "GET",
    ip: extra?.request.socket.remoteAddress,
})

/** True when the extras of a subscription connection are the ones this app keeps: they carry the upgrade request. */
export const isConnectionExtra = (value: unknown): value is ConnectionExtra =>
    typeof value === "object" && value !== null && "request" in value

/** Keeps the Authorization connection param on the connection when a subscription client initialises it. */
export const rememberAuthorization = (params: ConnectionParams | undefined, extra: ConnectionExtra): void => {
    extra.authorization = typeof params?.authorization === "string" ? params.authorization : undefined
}

/** The context of an operation: the HTTP pair as it arrived, or the request built from the subscription connection. */
export const graphqlContextOf = ({ req, res, extra }: GraphqlContextInput): GraphqlContext =>
    req === undefined ? { req: connectionRequestOf(extra), res: undefined } : { req, res }
