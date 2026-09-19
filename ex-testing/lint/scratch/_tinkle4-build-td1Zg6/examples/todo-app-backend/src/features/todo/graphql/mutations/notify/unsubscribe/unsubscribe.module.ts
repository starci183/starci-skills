import {
    Module 
} from "@nestjs/common"
import {
    CqrsModule 
} from "@nestjs/cqrs"
import {
    ConfigurableModuleClass 
} from "./unsubscribe.module-definition"
import {
    UnsubscribeResolver 
} from "./unsubscribe.resolver"

@Module({
    imports: [CqrsModule],
    providers: [UnsubscribeResolver],
})
/** unsubscribe's module: mounts UnsubscribeResolver; the command handler is discovered app-wide through CqrsModule. */
export class UnsubscribeSingleMutationModule extends ConfigurableModuleClass {}
