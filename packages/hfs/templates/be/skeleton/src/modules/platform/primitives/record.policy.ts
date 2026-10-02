/** True for a non-null object, so untrusted parsed data can be narrowed before any key is read. */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null
