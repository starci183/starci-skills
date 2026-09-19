import {
    ExampleAlreadyClaimedException,
} from "@modules/platform/exceptions/errors/example/example-already-claimed"
import {
    ExampleClaimEntity,
    ExampleClaimService,
    ExampleUserEntity,
} from "./example.service"

describe("ExampleClaimService",
    () => {
        const userId = "u1"
        const periodKey = "2026-01-05"

        /** Inline transaction mock matching Academy makeEntityManagerMock: callback runs with the same manager. */
        const makeManager = () => {
            const manager = {
                findOne: jest.fn(),
                findOneOrFail: jest.fn(),
                create: jest.fn((_: unknown, data: unknown) => data),
                save: jest.fn(async (entity: unknown) => entity),
                transaction: jest.fn(),
            }
            manager.transaction.mockImplementation(async (cb: (m: typeof manager) => Promise<unknown>) => cb(manager))
            return manager
        }

        it("throws ExampleAlreadyClaimedException when a claim row already exists",
            async () => {
                const manager = makeManager()
                manager.findOne.mockResolvedValueOnce({
                    userId,
                    periodKey,
                })
                const service = new ExampleClaimService(manager as never)

                await expect(service.claimReward(userId,
                    periodKey)).rejects.toBeInstanceOf(ExampleAlreadyClaimedException)
                expect(manager.save).not.toHaveBeenCalled()
            })

        it("writes the ledger and claim through the transaction manager",
            async () => {
                const manager = makeManager()
                manager.findOne.mockResolvedValueOnce(null)
                manager.findOneOrFail.mockResolvedValueOnce({
                    id: userId,
                    balance: 100,
                })
                const service = new ExampleClaimService(manager as never)

                await expect(service.claimReward(userId,
                    periodKey)).resolves.toEqual({
                    balance: 100,
                    points: 10,
                })

                expect(manager.transaction).toHaveBeenCalled()
                expect(manager.findOne).toHaveBeenCalledWith(
                    ExampleClaimEntity,
                    expect.objectContaining({
                        where: {
                            userId,
                            periodKey,
                        },
                    }),
                )
                expect(manager.save).toHaveBeenCalled()
                expect(manager.findOneOrFail).toHaveBeenCalledWith(
                    ExampleUserEntity,
                    expect.objectContaining({
                        where: {
                            id: userId,
                        },
                    }),
                )
            })
    })
