/** What create-resource takes: nothing beyond the caller, who owns the new row. */
export type CreateResourceRequest = Record<never, never>

/** What create-resource answers. */
export interface CreateResourceResult {
    /** The id of the new resource row. */
    readonly id: string
}
