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
    NotifySmtpClient, NotifySmtpModule, NotifySmtpPort
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

describe("notify-smtp module wiring",
    () => {
        it("register() binds the client to the port its consumers inject",
            async () => {
                const moduleRef = await Test.createTestingModule({
                    imports: [TestConfigModule,
                        NotifySmtpModule.register()],
                }).compile()
                try {
                    expect(moduleRef.get(NotifySmtpPort)).toBeInstanceOf(NotifySmtpClient)
                } finally {
                    await moduleRef.close()
                }
            })

        it("register({ isGlobal: true }) marks the dynamic module global; the default does not",
            () => {
                expect(NotifySmtpModule.register({
                    isGlobal: true
                }).global).toBe(true)
                expect(NotifySmtpModule.register().global).toBeFalsy()
            })

        it("a globally-registered module satisfies a consumer that never imports it",
            async () => {
                // The positive half of what the isGlobal extra is for.
                @Module({
                    providers: [{
                        provide: "CONSUMER", useFactory: (port: NotifySmtpPort) => port, inject: [NotifySmtpPort]
                    }],
                    exports: ["CONSUMER"],
                })
                class BareConsumerModule {}

                const moduleRef = await Test.createTestingModule({
                    imports: [TestConfigModule,
                        NotifySmtpModule.register({
                            isGlobal: true
                        }),
                        BareConsumerModule],
                }).compile()
                try {
                    expect(moduleRef.get("CONSUMER")).toBeInstanceOf(NotifySmtpClient)
                } finally {
                    await moduleRef.close()
                }
            })

        it("the same consumer fails to compile when the module is registered non-global",
            async () => {
                // The negative half: without isGlobal the port is invisible to a module that does not import it.
                @Module({
                    providers: [{
                        provide: "CONSUMER", useFactory: (port: NotifySmtpPort) => port, inject: [NotifySmtpPort]
                    }],
                    exports: ["CONSUMER"],
                })
                class BareConsumerModule {}

                await expect(
                    Test.createTestingModule({
                        imports: [TestConfigModule,
                            NotifySmtpModule.register(),
                            BareConsumerModule],
                    }).compile(),
                ).rejects.toThrow()
            })
    })
