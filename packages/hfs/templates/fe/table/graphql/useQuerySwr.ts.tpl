import useSWR from "swr"
import { query{{Singular}} } from "@/modules/api/graphql/queries/query-{{singular}}"
import type { Query{{Singular}}Data } from "@/modules/api/graphql/queries/types/{{singular}}"

/** The SWR key of the {{singular}} query; the full key carries the row id, the identity of its result. */
export const QUERY_{{singularUpper}}_SWR_KEY = "QUERY_{{singularUpper}}_SWR"

/** One {{singular}} row of the signed-in reader by id; no id, no request. A failure is thrown as the GraphQLResponse's message. */
export const useQuery{{Singular}}Swr = (id: string | undefined) =>
    useSWR(
        id === undefined ? null : ([QUERY_{{singularUpper}}_SWR_KEY, id] as const),
        async ([, rowId]): Promise<Query{{Singular}}Data> => {
            const response = await query{{Singular}}({ request: { id: rowId } })
            if (!response.success) throw new Error(response.message, { cause: response })
            return response.data
        },
    )
