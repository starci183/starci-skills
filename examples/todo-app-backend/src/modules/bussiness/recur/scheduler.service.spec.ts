import {
    SchedulerRegistry 
} from "@nestjs/schedule"
import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    CronJob 
} from "cron"
import {
    AppConfigService 
} from "@modules/platform/config/app-config.service"
import {
    WinstonService 
} from "@modules/platform/logging/winston.service"
import {
    GeneratorService 
} from "./generator.service"
import {
    SchedulerService 
} from "./scheduler.service"

/**
 * integration.recur.scheduler's wiring: onModuleInit registers a started CronJob named
 * 'recur-generation-tick' under the configured interval, and each tick delegates to
 * GeneratorService.runOnce. The registry is faked at the provider boundary so no real timer runs.
 */
describe("SchedulerService (integration.recur.scheduler)",
    () => {
        let moduleRef: TestingModule
        let scheduler: SchedulerService
        let runOnce: jest.Mock
        let addCronJob: jest.Mock

        beforeEach(async () => {
            runOnce = jest.fn().mockResolvedValue({
                materialised: [] 
            })
            addCronJob = jest.fn()
            moduleRef = await Test.createTestingModule({
                providers: [
                    SchedulerService,
                    AppConfigService,
                    WinstonService,
                    {
                        provide: GeneratorService, useValue: {
                            runOnce 
                        } 
                    },
                    {
                        provide: SchedulerRegistry, useValue: {
                            addCronJob 
                        } 
                    },
                ],
            }).compile()
            scheduler = moduleRef.get(SchedulerService)
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        it("onModuleInit registers a started CronJob named recur-generation-tick under the configured cron",
            () => {
                scheduler.onModuleInit()

                expect(addCronJob).toHaveBeenCalledTimes(1)
                const [name,
                    job] = addCronJob.mock.calls[0] as [string, CronJob]
                try {
                    expect(name).toBe("recur-generation-tick")
                    expect(job).toBeInstanceOf(CronJob)
                    expect(job.cronTime.source).toBe(moduleRef.get(AppConfigService).getRecurTickCron())
                    expect(job.running).toBe(true)
                } finally {
                    job.stop() // the fake registry never owns the job, so the spec stops the real timer it started
                }
            })

        it("each tick delegates to GeneratorService.runOnce",
            async () => {
                await scheduler.onTick()
                await scheduler.onTick()

                expect(runOnce).toHaveBeenCalledTimes(2)
                expect(runOnce.mock.calls[0][0]).toBeInstanceOf(Date)
            })
    })
