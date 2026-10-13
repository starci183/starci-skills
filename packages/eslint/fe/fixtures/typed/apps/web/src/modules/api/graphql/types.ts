/** The one result vocabulary of the fixture repository (`GraphQLResponse`), so a case can compose it. */
export interface GraphQLResponse<TData = undefined> {
    readonly success: boolean
    readonly message: string
    readonly error?: string
    readonly data?: TData
}
