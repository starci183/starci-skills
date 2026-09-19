import {
    Injectable 
} from "@nestjs/common"
import {
    CommandHandler 
} from "@nestjs/cqrs"
import {
    AbstractCommandHandler 
} from "@modules/platform/cqrs/abstract-handler"
import {
    PreferencesService 
} from "./preferences.service"
import {
    UpdateNotificationPreferencesCommand,
    UpdateNotificationPreferencesCommandResult,
} from "./update-notification-preferences.command"

@Injectable()
@CommandHandler(UpdateNotificationPreferencesCommand)
/** Decorated CQRS command handler; the bus dispatches to it and process() does the work (the abstract base keeps execute() a template). */
export class UpdateNotificationPreferencesHandler
    extends AbstractCommandHandler<UpdateNotificationPreferencesCommand, UpdateNotificationPreferencesCommandResult>
{
    constructor(
    private readonly preferences: PreferencesService,
    ) {
        super()
    }

    protected override async process(command: UpdateNotificationPreferencesCommand): Promise<UpdateNotificationPreferencesCommandResult> {
        const { params } = command
        const record = await this.preferences.update(params.actorId,
            params.channel,
            {
                unsubscribed: params.unsubscribed,
                digestWindowMinutes: params.digestWindowMinutes,
            })
        return {
            channel: record.channel, unsubscribed: record.unsubscribed, digestWindowMinutes: record.digestWindowMinutes 
        }
    }
}
