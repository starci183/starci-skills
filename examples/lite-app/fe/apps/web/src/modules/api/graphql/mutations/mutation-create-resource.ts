import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import type { CreateResourceMutation, CreateResourceMutationVariables } from "../__generated__/graphql"
import { createAuthApolloClient, graphqlResponseOf } from "../clients"
import type { GraphQLResponse, OperationParams } from "../types"
import type { MutateCreateResourceData } from "./types/create-resource"

/** The `createResource` mutation of the back end (be/src/features/api/resources, create-resource). */
const MUTATION_CREATE_RESOURCE: TypedDocumentNode<CreateResourceMutation, CreateResourceMutationVariables> = gql`
    mutation CreateResource {
        createResource {
            id
        }
    }
`

/** Creates one resource row owned by the signed-in reader. */
export const mutateCreateResource = async ({
    request,
    signal,
}: OperationParams<CreateResourceMutationVariables>): Promise<GraphQLResponse<MutateCreateResourceData>> =>
    graphqlResponseOf(
        await createAuthApolloClient({ signal }).mutate({ mutation: MUTATION_CREATE_RESOURCE, variables: request }),
        (data) => data.createResource,
    )
