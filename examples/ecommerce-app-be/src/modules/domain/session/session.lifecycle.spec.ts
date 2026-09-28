import "reflect-metadata"
import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    AppConfigService 
} from "@modules/platform/config/identity/app-config.service"
import {
    RedisPrimaryClient 
} from "@modules/platform/caches/redis/primary/redis.client"
import {
    SessionRepository 
} from "./session.repository"
import {
    SessionService 
} from "./session.service"

/**
 * The session expiry/revoke journey at unit scope: the real SessionService and SessionRepository
 * run over an in-memory stand-in for RedisPrimaryClient, so issue -> verify -> revoke -> verify
 * exercises the real key discipline (identity:session: prefix, store-held expiry) without a live
 * Redis. The real-server round trip is redis.client.spec.ts's own proof.
 */
describe("SessionService over the real SessionRepository - issue/verify/revoke",
    () => {
        const backing = new Map<string, string>()
        const redis = {
            async store(key: string, value: string): Promise<void> {
                backing.set(key,
                    value)
            },
            async lookup(key: string): Promise<string | null> {
                return backing.get(key) ?? null
            },
            async forget(key: string): Promise<void> {
                backing.delete(key)
            },
        }
        let service: SessionService

        beforeEach(async () => {
            backing.clear()
            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    SessionService,
                    SessionRepository,
                    {
                        provide: RedisPrimaryClient, useValue: redis 
                    },
                    {
                        provide: AppConfigService, useValue: {
                            getSessionTtlSeconds: () => 3600 
                        } 
                    },
                ],
            }).compile()
            service = module.get(SessionService)
        })

        it("an issued token verifies, and once revoked the same store no longer answers it",
            async () => {
                const issued = await service.issue("person-1")
                await expect(service.verify(issued.sessionToken)).resolves.toBe("person-1")

                await service.revoke(issued.sessionToken)

                await expect(service.verify(issued.sessionToken)).resolves.toBeNull()
            })

        it("revoking one token leaves the person's other live sessions untouched",
            async () => {
                const first = await service.issue("person-1")
                const second = await service.issue("person-1")

                await service.revoke(first.sessionToken)

                await expect(service.verify(second.sessionToken)).resolves.toBe("person-1")
                await expect(service.verify(first.sessionToken)).resolves.toBeNull()
            })

        it("a session holds only the person it was issued to - the stored value is never another's",
            async () => {
                const issued = await service.issue("person-1")
                await expect(service.verify(issued.sessionToken)).resolves.toBe("person-1")
                expect([...backing.values()]).toEqual(["person-1"])
            })
    })
