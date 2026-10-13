"use client"

import { useQueryVerifySessionSwr } from "./api/graphql"

/**
 * The mount point of the SWR queries that run app-wide for their side effect and have no component of their own: the
 * session check that ends a session the identity service refuses. It renders nothing, so a query that changes re-renders
 * only this component.
 */
export const SwrSideEffects = () => {
    useQueryVerifySessionSwr()
    return null
}
