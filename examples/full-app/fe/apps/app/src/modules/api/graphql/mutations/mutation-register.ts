import { createNoAuthApolloClient, graphqlResponseOf } from "@ecommerce/api"
import type { GraphQLResponse, OperationParams } from "@ecommerce/api"
import { identityGraphqlUrl } from "@/modules/config"
import { graphql } from "../__generated__"
import type { MutationRegisterResponse, MutationRegisterRequest } from "./types/register"

const mutation = graphql(`
    mutation Register($input: RegisterInput!) {
        register(input: $input) {
            personId
        }
    }
`)

/** Creates an account; a taken address is refused with `ACCOUNT_EMAIL_TAKEN`. Registration opens no session of its own. */
export const mutateRegister = async ({
    request,
    signal,
}: OperationParams<MutationRegisterRequest>): Promise<GraphQLResponse<MutationRegisterResponse>> =>
    graphqlResponseOf(
        await createNoAuthApolloClient({ uri: identityGraphqlUrl(), signal }).mutate({
            mutation,
            variables: { input: request },
        }),
        (data) => data.register,
    )
