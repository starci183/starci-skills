/**
 * Public entry of the api module: the transport calls a client may make (the shop's own session
 * door) and the result vocabulary every read and write answers in. Nothing here is server-only, so
 * a hook may import it; the service readers that need the session cookie or the service URLs live
 * in `modules/services`.
 */
export { postGraphql, postJson } from "./client"
export type { GraphqlResult, Result } from "./outcome"
export { closeSession, openSession } from "./session"
