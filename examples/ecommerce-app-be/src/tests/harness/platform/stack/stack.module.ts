import {
    Module 
} from "@nestjs/common"
import {
    E2EStackService 
} from "./e2e-stack.service"

@Module({
    providers: [E2EStackService],
    exports: [E2EStackService],
})
/** The test-infra stack platform module: E2EStackService owns compose up/down for the run. */
export class StackModule {}
