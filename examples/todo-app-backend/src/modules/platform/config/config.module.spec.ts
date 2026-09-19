import {
    Test 
} from "@nestjs/testing"
import {
    AppConfigService 
} from "./app-config.service"
import {
    ConfigModule 
} from "./config.module"

describe("ConfigModule",
    () => {
        it("register() provides and exports AppConfigService through the dynamic module",
            () => {
                const module = ConfigModule.register()

                expect(module.module).toBe(ConfigModule)
                expect(module.providers).toContain(AppConfigService)
                expect(module.exports).toContain(AppConfigService)
            })

        it("register() defaults to non-global and honors the isGlobal extra",
            () => {
                expect(ConfigModule.register().global).toBeFalsy()
                expect(ConfigModule.register({
                    isGlobal: true 
                }).global).toBe(true)
            })

        it("resolves AppConfigService from the Nest container when imported",
            async () => {
                const moduleRef = await Test.createTestingModule({
                    imports: [ConfigModule.register()],
                }).compile()
                try {
                    expect(moduleRef.get(AppConfigService)).toBeInstanceOf(AppConfigService)
                } finally {
                    await moduleRef.close()
                }
            })
    })
