import {
    Module 
} from "@nestjs/common"
import {
    CqrsModule 
} from "@nestjs/cqrs"
import {
    ConfigurableModuleClass 
} from "./upcoming-occurrences.module-definition"
import {
    UpcomingOccurrencesResolver 
} from "./upcoming-occurrences.resolver"

@Module({
    imports: [CqrsModule],
    providers: [UpcomingOccurrencesResolver],
})
/** upcomingOccurrences' module: mounts UpcomingOccurrencesResolver; the query handler is discovered app-wide through CqrsModule. */
export class UpcomingOccurrencesSingleQueryModule extends ConfigurableModuleClass {}
