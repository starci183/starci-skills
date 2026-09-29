import {
    Test 
} from "@nestjs/testing"
import {
    Clock 
} from "@modules/platform/clock/index"
import {
    IdentityConfigService, OrderConfigService 
} from "@modules/platform/config/index"
import {
    Logger 
} from "@modules/platform/logging/index"
import {
    AppModule 
} from "./app.module"

describe("migrate composition",
    () => {
        it("boots the real AppModule and resolves the clock, logging and both services' configuration it migrates with",
            async () => {
                const moduleRef = await Test.createTestingModule({
                    imports: [AppModule] 
                }).compile()
                try {
                    expect(moduleRef.get(Clock).now()).toBeInstanceOf(Date)
                    expect(moduleRef.get(Logger)).toBeDefined()
                    expect(moduleRef.get(IdentityConfigService)).toBeInstanceOf(IdentityConfigService)
                    expect(moduleRef.get(OrderConfigService)).toBeInstanceOf(OrderConfigService)
                } finally {
                    await moduleRef.close()
                }
            })
    })
