/** True for a non-null object (arrays included); narrows an unknown value before a property is read. */
export const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null
