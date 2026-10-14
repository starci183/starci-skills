import { useSWRConfig } from "swr"
import useSWRMutation from "swr/mutation"
import type { GraphQLResponse } from "@/modules/api"
import { mutateCreateResource } from "@/modules/api/graphql/mutations/mutation-create-resource"
import type { MutateCreateResourceData } from "@/modules/api/graphql/mutations/types/create-resource"
import { QUERY_RESOURCE_SWR_KEY } from "../queries/useQueryResourceSwr"

/** The SWR key of the create-resource mutation. */
export const MUTATE_CREATE_RESOURCE_SWR_KEY = "MUTATE_CREATE_RESOURCE_SWR"

/**
 * Creates one resource row; answers the GraphQLResponse so the caller reports it through modules/toast
 * (useGraphQLWithToast). A success primes the resource query of the new row with that response.
 */
export const useMutateCreateResourceSwr = () => {
    const { mutate } = useSWRConfig()
    return useSWRMutation(MUTATE_CREATE_RESOURCE_SWR_KEY, async () => {
        const response: GraphQLResponse<MutateCreateResourceData> = await mutateCreateResource({ request: {} })
        if (response.success) await mutate([QUERY_RESOURCE_SWR_KEY, response.data.id], response, { revalidate: false })
        return response
    })
}
