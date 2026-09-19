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
    UnsubscribeCommand, UnsubscribeCommandResult 
} from "./unsubscribe.command"

/** br.notify.unsubscribe.honored: unsubscribing is per person and per channel, and takes effect for
 * every event enqueued after it, immediately - `PreferencesService.setUnsubscribed` is read by
 * `NotifyService.admit` on every admission, so there is no separate cache to invalidate. */
@Injectable()
@CommandHandler(UnsubscribeCommand)
/** Decorated CQRS command handler; the bus dispatches to it and process() does the work (the abstract base keeps execute() a template). */
export class UnsubscribeHandler extends AbstractCommandHandler<UnsubscribeCommand, UnsubscribeCommandResult> {
    constructor(
    private readonly preferences: PreferencesService,
    ) {
        super()
    }

    protected override async process(command: UnsubscribeCommand): Promise<UnsubscribeCommandResult> {
        const { params } = command
        await this.preferences.setUnsubscribed(params.actorId,
            params.channel,
            true)
        return {
            channel: params.channel, unsubscribed: true 
        }
    }
}
