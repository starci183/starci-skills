import useSWRMutation from "swr/mutation"
import type { GraphQLResponse } from "@ecommerce/api"
import { mutateSignIn } from "@/modules/api/graphql/mutations/mutation-sign-in"
import type { MutationSignInRequest, MutationSignInResponse } from "@/modules/api/graphql/mutations/types/sign-in"

/** What one trigger of the mutation carries: its request. */
type Trigger = { readonly arg: MutationSignInRequest }

/** The SWR key of the `signIn` mutation. */
const MUTATE_SIGN_IN_SWR_KEY = "MUTATE_SIGN_IN_SWR"

/** Opens a session for an email and password pair (identity `signIn`). */
export const useMutateSignInSwr = () =>
    useSWRMutation(
        MUTATE_SIGN_IN_SWR_KEY,
        (_key: string, { arg }: Trigger): Promise<GraphQLResponse<MutationSignInResponse>> =>
            mutateSignIn({ request: arg }),
    )
