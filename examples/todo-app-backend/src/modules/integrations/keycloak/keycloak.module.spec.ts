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
    KeycloakClient, KeycloakModule
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

describe("keycloak module wiring",
    () => {
        it("register() binds the client its consumers inject",
            async () => {
                const moduleRef = await Test.createTestingModule({
                    imports: [TestConfigModule,
                        KeycloakModule.register()],
                }).compile()
                try {
                    expect(moduleRef.get(KeycloakClient)).toBeInstanceOf(KeycloakClient)
                } finally {
                    await moduleRef.close()
                }
            })

        it("register({ isGlobal: true }) marks the dynamic module global; the default does not",
            () => {
                expect(KeycloakModule.register({
                    isGlobal: true
                }).global).toBe(true)
                expect(KeycloakModule.register().global).toBeFalsy()
            })
    })
