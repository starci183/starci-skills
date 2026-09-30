import { strict as assert } from "node:assert"
import type { TestApi } from "../world/use-test-world"

/** The same door with every call riding on `token`; without a token every call is anonymous. */
export const asBearer = (api: TestApi, token?: string): TestApi => ({
    read: (document, options) => api.read(document, { ...options, token }),
    mutate: (document, options) => api.mutate(document, { ...options, token }),
})

/** The value when present; a spec reads an optional answer through it instead of asserting non-null. */
export const present = <TValue>(value: TValue | null | undefined, what: string): TValue => {
    assert(value !== null && value !== undefined, `${what} is absent`)
    return value
}
