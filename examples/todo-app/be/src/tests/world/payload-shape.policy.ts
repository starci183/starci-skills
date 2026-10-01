/** The structure of a JSON value with the values erased: what a real provider payload and a fake fixture must share. */
export type Shape = string | ReadonlyArray<Shape> | { readonly [key: string]: Shape }

/**
 * The shape of a parsed JSON payload: primitives become their type name, objects keep their keys (sorted, so key order never
 * matters) with the shapes of their values, an array becomes a list holding the shape of its first element (empty stays
 * empty). A contract spec compares `shapeOf(realPayload)` with `shapeOf(fixture)` to prove the fake still looks like the
 * provider.
 */
export const shapeOf = (value: unknown): Shape => {
    if (value === null) return "null"
    if (Array.isArray(value)) {
        const items: ReadonlyArray<unknown> = value
        return items.length === 0 ? [] : [shapeOf(items[0])]
    }
    if (typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value)
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([key, member]) => [key, shapeOf(member)]),
        )
    }
    return typeof value
}
