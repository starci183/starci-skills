import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import type { {{Singular}}Query, {{Singular}}QueryVariables } from "../__generated__/graphql"
import { createAuthApolloClient, graphqlResponseOf } from "../clients"
import type { GraphQLResponse, OperationParams } from "../types"
import type { Query{{Singular}}Data, Query{{Singular}}Request } from "./types/{{singular}}"

/** The `{{singularCamel}}` query of the back end (be/src/features/api/{{name}}, get-{{singular}}). */
const QUERY_{{singularUpper}}: TypedDocumentNode<{{Singular}}Query, {{Singular}}QueryVariables> = gql`
    query {{Singular}}($input: Get{{Singular}}Input!) {
        {{singularCamel}}(input: $input) {
            id
        }
    }
`

/** Reads one {{singular}} row of the signed-in reader. */
export const query{{Singular}} = async ({
    request,
    signal,
}: OperationParams<Query{{Singular}}Request>): Promise<GraphQLResponse<Query{{Singular}}Data>> =>
    graphqlResponseOf(
        await createAuthApolloClient({ signal }).query({ query: QUERY_{{singularUpper}}, variables: { input: request } }),
        (data) => data.{{singularCamel}},
    )
