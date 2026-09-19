import {
    Global, Module 
} from "@nestjs/common"
import {
    Test 
} from "@nestjs/testing"
import {
    AppConfigService 
} from "@modules/platform/config/app-config.service"
import {
    KeycloakModule 
} from "@modules/integrations/keycloak/keycloak.module"
import {
    NotifyQueueModule 
} from "@modules/integrations/notify-queue/notify-queue.module"
import {
    NotifySmtpClient 
} from "@modules/integrations/notify-smtp/notify-smtp.client"
import {
    NotifySmtpModule 
} from "@modules/integrations/notify-smtp/notify-smtp.module"
import {
    NotifySmtpPort 
} from "@modules/integrations/notify-smtp/notify-smtp.contracts"
import {
    SepayClient 
} from "@modules/integrations/sepay/sepay.client"
import {
    SepayModule 
} from "@modules/integrations/sepay/sepay.module"

/** Wiring edges the main module spec does not reach: SepayModule's own binding and the shared
 * isGlobal extra every integration module-definition carries. */

@Global()
@Module({
    providers: [{
        provide: AppConfigService, useValue: {
        } 
    }],
    exports: [AppConfigService],
})
class TestConfigModule {}

describe("integrations module wiring edge cases",
    () => {
        it("SepayModule.register() binds the client its consumers inject",
            async () => {
                const moduleRef = await Test.createTestingModule({
                    imports: [TestConfigModule,
                        SepayModule.register()],
                }).compile()
                try {
                    expect(moduleRef.get(SepayClient)).toBeInstanceOf(SepayClient)
                } finally {
                    await moduleRef.close()
                }
            })

        it("register({ isGlobal: true }) marks the dynamic module global; the default does not",
            async () => {
                // The shared ConfigurableModuleBuilder extra (nivo's isGlobal knob) must reach the returned module.
                expect(KeycloakModule.register({
                    isGlobal: true 
                }).global).toBe(true)
                expect(NotifyQueueModule.register({
                    isGlobal: true 
                }).global).toBe(true)
                expect(NotifySmtpModule.register({
                    isGlobal: true 
                }).global).toBe(true)
                expect(SepayModule.register({
                    isGlobal: true 
                }).global).toBe(true)

                expect(KeycloakModule.register().global).toBeFalsy()
                expect(SepayModule.register().global).toBeFalsy()
            })

        it("a globally-registered integration module satisfies a consumer that never imports it",
            async () => {
    // A consumer that injects the port without importing the integration module resolves only when
    // the isGlobal knob did its job - the positive half of what the extra is for.
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
