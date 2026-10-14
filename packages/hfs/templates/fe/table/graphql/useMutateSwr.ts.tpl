import { useSWRConfig } from "swr"
import useSWRMutation from "swr/mutation"
import type { GraphQLResponse } from "@/modules/api"
import { mutateCreate{{Singular}} } from "@/modules/api/graphql/mutations/mutation-create-{{singular}}"
import type { MutateCreate{{Singular}}Data } from "@/modules/api/graphql/mutations/types/create-{{singular}}"
import { QUERY_{{singularUpper}}_SWR_KEY } from "../queries/useQuery{{Singular}}Swr"

/** The SWR key of the create-{{singular}} mutation. */
export const MUTATE_CREATE_{{singularUpper}}_SWR_KEY = "MUTATE_CREATE_{{singularUpper}}_SWR"

/**
 * Creates one {{singular}} row; answers the GraphQLResponse so the caller reports it through modules/toast
 * (useGraphQLWithToast). A success primes the {{singular}} query of the new row with that response.
 */
export const useMutateCreate{{Singular}}Swr = () => {
    const { mutate } = useSWRConfig()
    return useSWRMutation(MUTATE_CREATE_{{singularUpper}}_SWR_KEY, async () => {
        const response: GraphQLResponse<MutateCreate{{Singular}}Data> = await mutateCreate{{Singular}}({ request: {} })
        if (response.success) await mutate([QUERY_{{singularUpper}}_SWR_KEY, response.data.id], response, { revalidate: false })
        return response
    })
}
