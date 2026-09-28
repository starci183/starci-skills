import { graphql, type Result } from "@/modules/api/graphql"

/** Send a recurrence operation through the shared GraphQL transport. */
export const executeRecur = <T,>(
    query: string,
    variables?: Readonly<Record<string, unknown>>,
    token?: string | null,
): Promise<Result<T>> => graphql<T>(query, variables, token)
