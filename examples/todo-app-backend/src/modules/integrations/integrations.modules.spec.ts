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
    KeycloakClient 
} from "@modules/integrations/keycloak/keycloak.client"
import {
    KeycloakModule 
} from "@modules/integrations/keycloak/keycloak.module"
import {
    NotifyQueueClient 
} from "@modules/integrations/notify-queue/notify-queue.client"
import {
    NotifyQueuePort 
} from "@modules/integrations/notify-queue/notify-queue.contracts"
import {
    NotifyQueueModule 
} from "@modules/integrations/notify-queue/notify-queue.module"
import {
    NotifySmtpClient 
} from "@modules/integrations/notify-smtp/notify-smtp.client"
import {
    NotifySmtpPort 
} from "@modules/integrations/notify-smtp/notify-smtp.contracts"
import {
    NotifySmtpModule 
} from "@modules/integrations/notify-smtp/notify-smtp.module"

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
