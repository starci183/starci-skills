import { SessionEndpointDelete, SessionEndpointPost } from "../../../features/pages/SessionEndpoint"

/** Next's fixed route entry delegates the session protocol to its feature owner. */
export const POST = SessionEndpointPost

/** Next's fixed route entry delegates sign-out to its feature owner. */
export const DELETE = SessionEndpointDelete
