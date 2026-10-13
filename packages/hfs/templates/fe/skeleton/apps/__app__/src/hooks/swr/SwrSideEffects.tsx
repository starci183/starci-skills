"use client"

/**
 * The mount point of the SWR queries that run app-wide for their side effect (hydrating redux as the route or the session
 * changes) and have no component of their own. It renders nothing, so a query that changes re-renders only this
 * component. A new app-wide query hook (hooks/swr/api/graphql/queries/useQuery*Swr) is called here.
 */
export const SwrSideEffects = () => null
