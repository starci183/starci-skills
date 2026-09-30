import { FakeClock, fakeCache } from "@starci/jest-preset"
import { CACHE } from "@modules/integrations/cache"
import { Test } from "@nestjs/testing"
import { SessionErrorCode } from "./errors/session.error"
import { SESSION_KEY } from "./session.cache-keys"
import { SessionService } from "./session.service"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

const build = async () => {
    const clock = new FakeClock("2026-01-01T00:00:00.000Z")
    const cache = fakeCache(clock)
    const moduleRef = await Test.createTestingModule({
        providers: [SessionService, { provide: CACHE, useValue: cache }],
    }).compile()
    return { sessions: moduleRef.get(SessionService), cache, clock }
}

describe("SessionService", () => {
    describe("issue", () => {
        it("returns a random uuid token and keeps the person behind it for an hour", async () => {
            const { sessions, cache } = await build()

            const issued = await sessions.issue({ personId: "p-1" })

            expect(issued.personId).toBe("p-1")
            expect(issued.sessionToken).toMatch(UUID)
            const request = { key: SESSION_KEY, args: [issued.sessionToken] }
            expect(cache.has(request)).toBe(true)
            expect(cache.ttlOf(request)).toBe(3600)
        })

        it("issues a different token for each session", async () => {
            const { sessions } = await build()

            const first = await sessions.issue({ personId: "p-1" })
            const second = await sessions.issue({ personId: "p-1" })

            expect(first.sessionToken).not.toBe(second.sessionToken)
        })
    })

    describe("verify", () => {
        it("returns the person behind a live token", async () => {
            const { sessions } = await build()
            const { sessionToken } = await sessions.issue({ personId: "p-1" })

            expect(await sessions.verify(sessionToken)).toEqual({ personId: "p-1" })
        })

        it("returns null for a token no session answers", async () => {
            const { sessions } = await build()

            expect(await sessions.verify("unknown-token")).toBeNull()
        })

        it("returns null for a blank token without reading the cache", async () => {
            const { sessions, cache } = await build()
            await sessions.issue({ personId: "p-1" })
            const reads = jest.spyOn(cache, "get")

            expect(await sessions.verify("")).toBeNull()
            expect(reads).not.toHaveBeenCalled()
        })

        it("returns null once the hour is over", async () => {
            const { sessions, clock } = await build()
            const { sessionToken } = await sessions.issue({ personId: "p-1" })

            clock.advance(3600 * 1000 + 1)

            expect(await sessions.verify(sessionToken)).toBeNull()
        })
    })

    describe("authenticate", () => {
        it("succeeds with the person behind a live token", async () => {
            const { sessions } = await build()
            const { sessionToken } = await sessions.issue({ personId: "p-1" })

            expect(await sessions.authenticate(sessionToken)).toSucceedWith({ personId: "p-1" })
        })

        it("refuses a token no session answers", async () => {
            const { sessions } = await build()

            expect(await sessions.authenticate("unknown-token")).toBeRefused(SessionErrorCode.Invalid)
        })
    })

    describe("revoke", () => {
        it("ends the session so the token no longer verifies", async () => {
            const { sessions, cache } = await build()
            const { sessionToken } = await sessions.issue({ personId: "p-1" })

            await sessions.revoke(sessionToken)

            expect(cache.has({ key: SESSION_KEY, args: [sessionToken] })).toBe(false)
            expect(await sessions.verify(sessionToken)).toBeNull()
        })

        it("accepts an unknown token", async () => {
            const { sessions } = await build()

            await expect(sessions.revoke("unknown-token")).resolves.toBeUndefined()
        })
    })

    describe("revokeOwn", () => {
        it("ends a session of the person and confirms it", async () => {
            const { sessions } = await build()
            const { sessionToken } = await sessions.issue({ personId: "p-1" })

            expect(await sessions.revokeOwn({ personId: "p-1", sessionToken })).toSucceedWith({ revoked: true })
            expect(await sessions.verify(sessionToken)).toBeNull()
        })

        it("refuses a token of another person and keeps that session alive", async () => {
            const { sessions } = await build()
            const { sessionToken } = await sessions.issue({ personId: "p-2" })

            expect(await sessions.revokeOwn({ personId: "p-1", sessionToken })).toBeRefused(SessionErrorCode.Invalid)
            expect(await sessions.verify(sessionToken)).toEqual({ personId: "p-2" })
        })

        it("refuses an unknown token", async () => {
            const { sessions } = await build()

            expect(await sessions.revokeOwn({ personId: "p-1", sessionToken: "unknown-token" })).toBeRefused(
                SessionErrorCode.Invalid,
            )
        })
    })
})
