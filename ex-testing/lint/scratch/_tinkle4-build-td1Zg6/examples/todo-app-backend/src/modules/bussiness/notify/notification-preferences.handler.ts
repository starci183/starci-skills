import {
    Injectable 
} from "@nestjs/common"
import {
    QueryHandler 
} from "@nestjs/cqrs"
import {
    AbstractQueryHandler 
} from "@modules/platform/cqrs/abstract-handler"
import {
    PreferencesService 
} from "./preferences.service"
import {
    NotificationPreferencesQuery, NotificationPreferencesQueryResult 
} from "./notification-preferences.query"

@Injectable()
@QueryHandler(NotificationPreferencesQuery)
/** Decorated CQRS query handler; the bus dispatches to it and process() does the work (the abstract base keeps execute() a template). */
export class NotificationPreferencesHandler
    extends AbstractQueryHandler<NotificationPreferencesQuery, NotificationPreferencesQueryResult>
{
    constructor(
    private readonly preferences: PreferencesService,
    ) {
        super()
    }

    protected override async process(query: NotificationPreferencesQuery): Promise<NotificationPreferencesQueryResult> {
        const record = await this.preferences.get(query.params.actorId,
            query.params.channel)
        return {
            channel: record.channel, unsubscribed: record.unsubscribed, digestWindowMinutes: record.digestWindowMinutes 
        }
    }
}
