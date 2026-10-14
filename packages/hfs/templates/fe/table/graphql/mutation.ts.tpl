import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import type { Create{{Singular}}Mutation, Create{{Singular}}MutationVariables } from "../__generated__/graphql"
import { createAuthApolloClient, graphqlResponseOf } from "../clients"
import type { GraphQLResponse, OperationParams } from "../types"
import type { MutateCreate{{Singular}}Data } from "./types/create-{{singular}}"

/** The `create{{Singular}}` mutation of the back end (be/src/features/api/{{name}}, create-{{singular}}). */
const MUTATION_CREATE_{{singularUpper}}: TypedDocumentNode<Create{{Singular}}Mutation, Create{{Singular}}MutationVariables> = gql`
    mutation Create{{Singular}} {
        create{{Singular}} {
            id
        }
    }
`

/** Creates one {{singular}} row owned by the signed-in reader. */
export const mutateCreate{{Singular}} = async ({
    request,
    signal,
}: OperationParams<Create{{Singular}}MutationVariables>): Promise<GraphQLResponse<MutateCreate{{Singular}}Data>> =>
    graphqlResponseOf(
        await createAuthApolloClient({ signal }).mutate({ mutation: MUTATION_CREATE_{{singularUpper}}, variables: request }),
        (data) => data.create{{Singular}},
    )
