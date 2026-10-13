import useSWR from "swr"
import { queryResource } from "@/modules/api/graphql/queries/query-resource"
import type { QueryResourceData } from "@/modules/api/graphql/queries/types/resource"

/** The SWR key of the resource query; the full key carries the row id, the identity of its result. */
export const QUERY_RESOURCE_SWR_KEY = "QUERY_RESOURCE_SWR"

/** One resource row of the signed-in reader by id; no id, no request. A failure is thrown as the GraphQLResponse's message. */
export const useQueryResourceSwr = (id: string | undefined) =>
    useSWR(
        id === undefined ? null : ([QUERY_RESOURCE_SWR_KEY, id] as const),
        async ([, rowId]): Promise<QueryResourceData> => {
            const response = await queryResource({ request: { id: rowId } })
            if (!response.success) throw new Error(response.message, { cause: response })
            return response.data
        },
    )
