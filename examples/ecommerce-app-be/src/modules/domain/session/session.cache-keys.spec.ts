import { SESSION_KEY } from "./session.cache-keys"

describe("SESSION_KEY", () => {
    it("keeps a session for an hour in redis", () => {
        expect(SESSION_KEY).toMatchObject({ name: "identity.session", ttl: { seconds: 3600 }, store: "redis" })
    })

    it("reads only a string as a person id", () => {
        expect(SESSION_KEY.parse("p-1")).toBe("p-1")
        expect(SESSION_KEY.parse({ personId: "p-1" })).toBeNull()
    })
})
