import { describe, expect, it } from "vitest"
import vi from "./messages/vi.json"

const leaves = (value: unknown, path = ""): Array<string> =>
    typeof value === "object" && value !== null
        ? Object.entries(value).flatMap(([key, child]) => leaves(child, path ? `${path}.${key}` : key))
        : [path]

const valueAt = (path: string): unknown =>
    path.split(".").reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], vi)

describe("messages/vi.json", () => {
    it("carries the strings the error, not-found and loading routes render", () => {
        expect(leaves(vi)).toEqual(
            expect.arrayContaining([
                "errors.global.retry",
                "errors.global.title",
                "errors.page.retry",
                "errors.page.title",
                "loading.label",
                "notFound.title",
            ]),
        )
    })

    it("has no empty string", () => {
        for (const path of leaves(vi)) expect(valueAt(path)).not.toBe("")
    })
})
