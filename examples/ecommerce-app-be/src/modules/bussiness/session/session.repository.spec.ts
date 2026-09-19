import "reflect-metadata"
import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    RedisPrimaryClient 
} from "@modules/platform/caches/redis/primary/redis.client"
import {
    SessionRepository 
} from "./session.repository"

describe("SessionRepository - integration.checkout.redis key discipline",
    () => {
        let repository: SessionRepository
        let redis: { store: jest.Mock; lookup: jest.Mock; forget: jest.Mock }

        beforeEach(async () => {
            redis = {
                store: jest.fn(), lookup: jest.fn(), forget: jest.fn() 
            }
            const module: TestingModule = await Test.createTestingModule({
                providers: [SessionRepository,
                    {
                        provide: RedisPrimaryClient, useValue: redis 
                    }],
            }).compile()
            repository = module.get(SessionRepository)
        })

        it("names every session key under the identity:session: prefix",
            () => {
                expect(repository.keyFor("token-abc")).toBe("identity:session:token-abc")
            })

        it("stores the person id under the prefixed key with the TTL the caller was given",
            async () => {
                await repository.store("token-abc",
                    "person-1",
                    60)
                expect(redis.store).toHaveBeenCalledWith("identity:session:token-abc",
                    "person-1",
                    60)
            })

        it("looks up only through the prefixed key and passes the store answer through",
            async () => {
                redis.lookup.mockResolvedValue("person-1")
                await expect(repository.lookup("token-abc")).resolves.toBe("person-1")
                expect(redis.lookup).toHaveBeenCalledWith("identity:session:token-abc")

                redis.lookup.mockResolvedValue(null)
                await expect(repository.lookup("token-gone")).resolves.toBeNull()
            })

        it("forgets through the prefixed key",
            async () => {
                await repository.forget("token-abc")
                expect(redis.forget).toHaveBeenCalledWith("identity:session:token-abc")
            })
    })
