import useSWR from "swr"
import type { GraphQLResponse } from "@/modules/api"
import { query{{Singular}} } from "@/modules/api/graphql/queries/query-{{singular}}"
import type { Query{{Singular}}Data } from "@/modules/api/graphql/queries/types/{{singular}}"

/** The SWR key of the {{singular}} query; the full key carries the row id, the identity of its result. */
export const QUERY_{{singularUpper}}_SWR_KEY = "QUERY_{{singularUpper}}_SWR"

/** One {{singular}} row of the signed-in reader by id, as its GraphQLResponse; no id, no request. */
export const useQuery{{Singular}}Swr = (id: string | undefined) =>
    useSWR(
        id === undefined ? null : ([QUERY_{{singularUpper}}_SWR_KEY, id] as const),
        ([, rowId]): Promise<GraphQLResponse<Query{{Singular}}Data>> => query{{Singular}}({ request: { id: rowId } }),
    )
