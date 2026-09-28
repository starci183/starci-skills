import "reflect-metadata"
import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    AppConfigService 
} from "@modules/platform/config/identity/app-config.service"
import {
    SessionRepository 
} from "./session.repository"
import {
    SessionService 
} from "./session.service"

describe("SessionService - br.identity.sign-in session lifecycle",
    () => {
        const SESSION_TTL = 3600
        let service: SessionService
        let sessions: { store: jest.Mock; lookup: jest.Mock; forget: jest.Mock }

        beforeEach(async () => {
            sessions = {
                store: jest.fn(), lookup: jest.fn(), forget: jest.fn() 
            }
            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    SessionService,
                    {
                        provide: SessionRepository, useValue: sessions 
                    },
                    {
                        provide: AppConfigService, useValue: {
                            getSessionTtlSeconds: () => SESSION_TTL 
                        } 
                    },
                ],
            }).compile()
            service = module.get(SessionService)
        })

        it("issues an opaque uuid token bound to the configured TTL, never a self-describing credential",
            async () => {
                const issued = await service.issue("person-1")
                expect(issued.personId).toBe("person-1")
                expect(issued.sessionToken).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
                expect(sessions.store).toHaveBeenCalledWith(issued.sessionToken,
                    "person-1",
                    SESSION_TTL)
            })

        it("issues a fresh token per call - two sign-ins never share a session",
            async () => {
                const first = await service.issue("person-1")
                const second = await service.issue("person-1")
                expect(second.sessionToken).not.toBe(first.sessionToken)
            })

        it("verifies a live token into only the person behind it",
            async () => {
                sessions.lookup.mockResolvedValue("person-1")
                await expect(service.verify("token-abc")).resolves.toBe("person-1")
                expect(sessions.lookup).toHaveBeenCalledWith("token-abc")
            })

        it("verifies a dead token into null",
            async () => {
                sessions.lookup.mockResolvedValue(null)
                await expect(service.verify("token-gone")).resolves.toBeNull()
            })

        it("refuses an empty token without touching the store",
            async () => {
                await expect(service.verify("")).resolves.toBeNull()
                expect(sessions.lookup).not.toHaveBeenCalled()
            })

        it("revokes by forgetting the exact token",
            async () => {
                await service.revoke("token-abc")
                expect(sessions.forget).toHaveBeenCalledWith("token-abc")
            })

        it("a store failure while issuing propagates - the caller learns no session was written",
            async () => {
                const failure = new Error("Redis did not become ready within 1500ms")
                sessions.store.mockRejectedValue(failure)
                await expect(service.issue("person-1")).rejects.toBe(failure)
            })

        it("a lookup failure while verifying propagates instead of answering null for a live token",
            async () => {
                const failure = new Error("Redis connection is end.")
                sessions.lookup.mockRejectedValue(failure)
                await expect(service.verify("token-abc")).rejects.toBe(failure)
            })

        it("a forget failure while revoking propagates - the caller learns the token may still be live",
            async () => {
                const failure = new Error("Redis connection is end.")
                sessions.forget.mockRejectedValue(failure)
                await expect(service.revoke("token-abc")).rejects.toBe(failure)
            })
    })
