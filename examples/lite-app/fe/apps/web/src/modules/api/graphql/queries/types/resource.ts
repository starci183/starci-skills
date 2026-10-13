import type { ResourceQuery, ResourceQueryVariables } from "../../__generated__/graphql"

/** What queryResource takes: the input of the `resource` query (generated from the back end's contract). */
export type QueryResourceRequest = ResourceQueryVariables["input"]

/** What queryResource answers: the `resource` field. */
export type QueryResourceData = ResourceQuery["resource"]
