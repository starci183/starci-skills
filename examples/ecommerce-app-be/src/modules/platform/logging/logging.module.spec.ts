import {
    Test 
} from "@nestjs/testing"
import {
    ClockModule 
} from "@modules/platform/clock/index"
import {
    Logger 
} from "./logger.port"
import {
    LoggingModule 
} from "./logging.module"

describe("LoggingModule",
    () => {
        it("provides the Logger port built over the app's Clock",
            async () => {
                const moduleRef = await Test.createTestingModule({
                    imports: [ClockModule.register({
                        isGlobal: true 
                    }),
                    LoggingModule],
                }).compile()

                try {
                    const logger = moduleRef.get(Logger)

                    expect(logger).toBeInstanceOf(Logger)
                } finally {
                    await moduleRef.close()
                }
            })
    })
