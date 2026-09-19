import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    LogEvent 
} from "@modules/platform/logging/log-events"
import {
    WinstonService 
} from "@modules/platform/logging/winston.service"
import {
    NotifyScheduler 
} from "./notify.scheduler"
import {
    NotifyService 
} from "./notify.service"

describe("NotifyScheduler",
    () => {
        let moduleRef: TestingModule

        beforeEach(() => {
            jest.useFakeTimers()
        })

        afterEach(async () => {
            await moduleRef.close()
            jest.useRealTimers()
        })

        it("ticks NotifyService.runDueJobs on an interval once started, and stops on destroy",
            async () => {
                const runDueJobs = jest.fn().mockResolvedValue(undefined)
                moduleRef = await Test.createTestingModule({
                    providers: [
                        NotifyScheduler,
                        {
                            provide: NotifyService, useValue: {
                                runDueJobs 
                            } 
                        },
                        {
                            provide: WinstonService, useValue: {
                                log: jest.fn() 
                            } 
                        },
                    ],
                }).compile()
                const scheduler = moduleRef.get(NotifyScheduler)

                scheduler.onModuleInit()
                jest.advanceTimersByTime(5_000)
                jest.advanceTimersByTime(5_000)
                expect(runDueJobs).toHaveBeenCalledTimes(2)
                expect(runDueJobs.mock.calls[0][0]).toBeInstanceOf(Date)

                scheduler.onModuleDestroy()
                jest.advanceTimersByTime(10_000)
                expect(runDueJobs).toHaveBeenCalledTimes(2)
            })

        it("contains a rejecting tick inside the interval instead of letting it escape unhandled",
            async () => {
                const runDueJobs = jest.fn().mockRejectedValue(new Error("database down"))
                const log = jest.fn()
                moduleRef = await Test.createTestingModule({
                    providers: [
                        NotifyScheduler,
                        {
                            provide: NotifyService, useValue: {
                                runDueJobs 
                            } 
                        },
                        {
                            provide: WinstonService, useValue: {
                                log 
                            } 
                        },
                    ],
                }).compile()
                const scheduler = moduleRef.get(NotifyScheduler)

                scheduler.onModuleInit()
                jest.advanceTimersByTime(5_000)
                for (let i = 0; i < 5; i += 1) await Promise.resolve()

                expect(log).toHaveBeenCalledWith(LogEvent.NOTIFY_DISPATCH_TICK_FAILED,
                    {
                        reason: expect.stringContaining("database down") 
                    })
            })
    })
