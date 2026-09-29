import {
    Test 
} from "@nestjs/testing"
import {
    Clock 
} from "./clock.port"
import {
    ClockModule 
} from "./clock.module"
import {
    SystemClock 
} from "./system-clock"

describe("ClockModule",
    () => {
        it("provides the Clock port backed by the system clock",
            async () => {
                const moduleRef = await Test.createTestingModule({
                    imports: [ClockModule.register()] 
                }).compile()

                expect(moduleRef.get(Clock)).toBeInstanceOf(SystemClock)
            })

        it("defaults to non-global and honors the isGlobal extra",
            () => {
                expect(ClockModule.register().global).toBeFalsy()
                expect(ClockModule.register({
                    isGlobal: true 
                }).global).toBe(true)
            })
    })
