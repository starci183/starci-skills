/** True for a non-null object, so untrusted parsed data can be narrowed before any key is read. */
export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null
}
