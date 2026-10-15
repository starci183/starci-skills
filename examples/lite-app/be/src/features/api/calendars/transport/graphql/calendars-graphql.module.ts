import { Module } from "@nestjs/common"
import { CalendarsApiModule } from "../../calendars.module"
import { ConfigurableModuleClass } from "./calendars-graphql.module-definition"
import { CreateCalendarResolver } from "./create-calendar.resolver"
import { GetCalendarResolver } from "./get-calendar.resolver"

@Module({ imports: [CalendarsApiModule.register({})], providers: [GetCalendarResolver, CreateCalendarResolver] })
/** The GraphQL transport of the calendars feature. */
export class CalendarsGraphqlModule extends ConfigurableModuleClass {}
