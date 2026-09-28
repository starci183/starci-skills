import {
    Module 
} from "@nestjs/common"
import {
    CqrsModule 
} from "@nestjs/cqrs"
import {
    ConfigurableModuleClass 
} from "./export-my-data.module-definition"
import {
    ExportMyDataResolver 
} from "./export-my-data.resolver"

@Module({
    imports: [CqrsModule],
    providers: [ExportMyDataResolver],
})
/** exportMyData's module: mounts ExportMyDataResolver; the query handler is discovered app-wide through CqrsModule. */
export class ExportMyDataSingleQueryModule extends ConfigurableModuleClass {}
