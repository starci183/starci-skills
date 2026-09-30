import { mock } from "@starci/jest-preset/mock"
import type { Cache } from "@modules/integrations/cache"
import { SESSION_KEY } from "./session.cache-keys"
import { SessionService } from "./session.service"

describe("SessionService", () => {
    it("issues an opaque token and stores the person under it", async () => {
        const cache = mock<Cache>({ set: jest.fn().mockResolvedValue(undefined) })
        const issued = await new SessionService(cache).issue({ personId: "p-1" })
        expect(issued.personId).toBe("p-1")
        expect(issued.sessionToken).toMatch(/^[0-9a-f-]{36}$/)
        expect(cache.set).toHaveBeenCalledWith({ key: SESSION_KEY, args: [issued.sessionToken], value: "p-1" })
    })

    it("names the person behind a live token and answers null for an unknown or empty one", async () => {
        const cache = mock<Cache>({ get: jest.fn().mockResolvedValueOnce("p-1").mockResolvedValueOnce(null) })
        const service = new SessionService(cache)
        await expect(service.verify("live")).resolves.toEqual({ personId: "p-1" })
        await expect(service.verify("dead")).resolves.toBeNull()
        await expect(service.verify("")).resolves.toBeNull()
        expect(cache.get).toHaveBeenCalledTimes(2)
    })

    it("revokes by deleting the entry", async () => {
        const cache = mock<Cache>({ del: jest.fn().mockResolvedValue(undefined) })
        await new SessionService(cache).revoke("tok")
        expect(cache.del).toHaveBeenCalledWith({ key: SESSION_KEY, args: ["tok"] })
    })
})
