import useSWRMutation from "swr/mutation"
import type { GraphQLResponse } from "@ecommerce/api"
import { mutateRegister } from "@/modules/api/graphql/mutations/mutation-register"
import type { MutationRegisterRequest, MutationRegisterResponse } from "@/modules/api/graphql/mutations/types/register"

/** What one trigger of the mutation carries: its request. */
type Trigger = { readonly arg: MutationRegisterRequest }

/** The SWR key of the `register` mutation. */
const MUTATE_REGISTER_SWR_KEY = "MUTATE_REGISTER_SWR"

/** Creates an account (identity `register`). */
export const useMutateRegisterSwr = () =>
    useSWRMutation(
        MUTATE_REGISTER_SWR_KEY,
        (_key: string, { arg }: Trigger): Promise<GraphQLResponse<MutationRegisterResponse>> =>
            mutateRegister({ request: arg }),
    )
