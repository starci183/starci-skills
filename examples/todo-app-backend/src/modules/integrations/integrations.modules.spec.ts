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
    KeycloakClient,
} from "@modules/integrations/keycloak/index"
import {
    KeycloakModule,
} from "@modules/integrations/keycloak/index"
import {
    NotifyQueueClient,
} from "@modules/integrations/notify-queue/index"
import {
    NotifyQueuePort,
} from "@modules/integrations/notify-queue/index"
import {
    NotifyQueueModule,
} from "@modules/integrations/notify-queue/index"
import {
    NotifySmtpClient,
} from "@modules/integrations/notify-smtp/index"
import {
    NotifySmtpPort,
} from "@modules/integrations/notify-smtp/index"
import {
    NotifySmtpModule,
} from "@modules/integrations/notify-smtp/index"

/** Each integration module resolves AppConfigService from the globally-registered ConfigModule
 * (see keycloak.module.ts's comment); this stub stands in for that global provider. */
@Global()
@Module({
    providers: [{
        provide: AppConfigService, useValue: {
        } 
    }],
    exports: [AppConfigService],
})
class TestConfigModule {}

describe("integrations module wiring",
    () => {
        it("register() binds each client to the token its consumers inject",
            async () => {
                const moduleRef = await Test.createTestingModule({
                    imports: [TestConfigModule,
                        KeycloakModule.register(),
                        NotifyQueueModule.register(),
                        NotifySmtpModule.register()],
                }).compile()
                try {
                    expect(moduleRef.get(KeycloakClient)).toBeInstanceOf(KeycloakClient)
                    expect(moduleRef.get(NotifyQueuePort)).toBeInstanceOf(NotifyQueueClient)
                    expect(moduleRef.get(NotifySmtpPort)).toBeInstanceOf(NotifySmtpClient)
                } finally {
                    await moduleRef.close()
                }
            })
    })
