import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import type { ResourceQuery, ResourceQueryVariables } from "../__generated__/graphql"
import { createAuthApolloClient, graphqlResponseOf } from "../clients"
import type { GraphQLResponse, OperationParams } from "../types"
import type { QueryResourceData, QueryResourceRequest } from "./types/resource"

/** The `resource` query of the back end (be/src/features/api/resources, get-resource). */
const QUERY_RESOURCE: TypedDocumentNode<ResourceQuery, ResourceQueryVariables> = gql`
    query Resource($input: GetResourceInput!) {
        resource(input: $input) {
            id
        }
    }
`

/** Reads one resource row of the signed-in reader. */
export const queryResource = async ({
    request,
    signal,
}: OperationParams<QueryResourceRequest>): Promise<GraphQLResponse<QueryResourceData>> =>
    graphqlResponseOf(
        await createAuthApolloClient({ signal }).query({ query: QUERY_RESOURCE, variables: { input: request } }),
        (data) => data.resource,
    )
