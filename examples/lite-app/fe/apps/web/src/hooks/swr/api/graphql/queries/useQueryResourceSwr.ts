import useSWR from "swr"
import type { GraphQLResponse } from "@/modules/api"
import { queryResource } from "@/modules/api/graphql/queries/query-resource"
import type { QueryResourceData } from "@/modules/api/graphql/queries/types/resource"

/** The SWR key of the resource query; the full key carries the row id, the identity of its result. */
export const QUERY_RESOURCE_SWR_KEY = "QUERY_RESOURCE_SWR"

/** One resource row of the signed-in reader by id, as its GraphQLResponse; no id, no request. */
export const useQueryResourceSwr = (id: string | undefined) =>
    useSWR(
        id === undefined ? null : ([QUERY_RESOURCE_SWR_KEY, id] as const),
        ([, rowId]): Promise<GraphQLResponse<QueryResourceData>> => queryResource({ request: { id: rowId } }),
    )
