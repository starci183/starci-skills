import {
    Module 
} from "@nestjs/common"
import {
    CqrsModule 
} from "@nestjs/cqrs"
import {
    ConfigurableModuleClass 
} from "./request-erasure.module-definition"
import {
    RequestErasureResolver 
} from "./request-erasure.resolver"

/** SessionService is not imported here - see create-task.module.ts's comment; it is registered globally
 * once from app.module.ts. */
@Module({
    imports: [CqrsModule],
    providers: [RequestErasureResolver],
})
/** requestErasure's module: mounts RequestErasureResolver; the command handler is discovered app-wide through CqrsModule. */
export class RequestErasureSingleMutationModule extends ConfigurableModuleClass {}
