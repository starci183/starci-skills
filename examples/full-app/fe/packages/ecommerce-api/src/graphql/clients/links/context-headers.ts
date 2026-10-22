const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null

/** The string headers an earlier link put on the operation context. Apollo types the context `any`, so they are read as `unknown` and only strings are kept. */
export const contextHeaders = (context: Readonly<Record<string, unknown>>): Record<string, string> => {
    const kept: Record<string, string> = {}
    if (!isRecord(context.headers)) return kept
    for (const [name, value] of Object.entries(context.headers)) if (typeof value === "string") kept[name] = value
    return kept
}
