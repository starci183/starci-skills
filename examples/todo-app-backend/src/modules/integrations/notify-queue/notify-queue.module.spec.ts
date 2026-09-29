import {
    Global, Module
} from "@nestjs/common"
import {
    Test
} from "@nestjs/testing"
import {
    AppConfigService,
} from "@modules/platform/config/index"
import {
    NotifyQueueClient, NotifyQueueModule, NotifyQueuePort
} from "./index"

/** The module resolves AppConfigService from the globally-registered ConfigModule; this stub stands in for that global provider. */
@Global()
@Module({
    providers: [{
        provide: AppConfigService, useValue: {
        }
    }],
    exports: [AppConfigService],
})
class TestConfigModule {}

describe("notify-queue module wiring",
    () => {
        it("register() binds the client to the port its consumers inject",
            async () => {
                const moduleRef = await Test.createTestingModule({
                    imports: [TestConfigModule,
                        NotifyQueueModule.register()],
                }).compile()
                try {
                    expect(moduleRef.get(NotifyQueuePort)).toBeInstanceOf(NotifyQueueClient)
                } finally {
                    await moduleRef.close()
                }
            })

        it("register({ isGlobal: true }) marks the dynamic module global; the default does not",
            () => {
                expect(NotifyQueueModule.register({
                    isGlobal: true
                }).global).toBe(true)
                expect(NotifyQueueModule.register().global).toBeFalsy()
            })
    })
