import {
    Module 
} from "@nestjs/common"
import {
    CqrsModule 
} from "@nestjs/cqrs"
import {
    ConfigurableModuleClass 
} from "./complete-erasure.module-definition"
import {
    CompleteErasureResolver 
} from "./complete-erasure.resolver"

@Module({
    imports: [CqrsModule],
    providers: [CompleteErasureResolver],
})
/** completeErasure's module: mounts CompleteErasureResolver; the command handler is discovered app-wide through CqrsModule. */
export class CompleteErasureSingleMutationModule extends ConfigurableModuleClass {}
