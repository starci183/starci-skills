import {
    Test 
} from "@nestjs/testing"
import {
    AppConfigService 
} from "@modules/platform/config/index"
import {
    WinstonService 
} from "@modules/platform/logging/index"
import {
    AppModule 
} from "./app.module"

describe("migrate composition",
    () => {
        it("boots the real AppModule and resolves the config and logging it migrates with",
            async () => {
                const moduleRef = await Test.createTestingModule({
                    imports: [AppModule] 
                }).compile()
                try {
                    expect(moduleRef.get(AppConfigService)).toBeInstanceOf(AppConfigService)
                    expect(moduleRef.get(WinstonService)).toBeInstanceOf(WinstonService)
                } finally {
                    await moduleRef.close()
                }
            })
    })
