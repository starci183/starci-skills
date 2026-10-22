import { createNoAuthApolloClient, graphqlResponseOf } from "@ecommerce/api"
import type { GraphQLResponse, OperationParams } from "@ecommerce/api"
import { identityGraphqlUrl } from "@/modules/config"
import { graphql } from "../__generated__"
import type { MutationSignInResponse, MutationSignInRequest } from "./types/sign-in"

const mutation = graphql(`
    mutation SignIn($input: SignInInput!) {
        signIn(input: $input) {
            sessionToken
            personId
        }
    }
`)

/** Checks an email and password pair and opens a session; a wrong pair is refused with `ACCOUNT_INVALID_CREDENTIALS`, naming neither half. */
export const mutateSignIn = async ({
    request,
    signal,
}: OperationParams<MutationSignInRequest>): Promise<GraphQLResponse<MutationSignInResponse>> =>
    graphqlResponseOf(
        await createNoAuthApolloClient({ uri: identityGraphqlUrl(), signal }).mutate({
            mutation,
            variables: { input: request },
        }),
        (data) => data.signIn,
    )
