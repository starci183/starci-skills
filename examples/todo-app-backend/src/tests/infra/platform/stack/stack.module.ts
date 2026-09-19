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
/**
 * The platform layer's stack capability: owns the spec-scoped compose project plus the api child
 * process, boots both on module init and tears them down (with verification) on shutdown. Reads
 * TESTING_INFRA_OPTIONS, which TestingInfraModule.register() publishes globally.
 */
export class E2EStackModule {}
