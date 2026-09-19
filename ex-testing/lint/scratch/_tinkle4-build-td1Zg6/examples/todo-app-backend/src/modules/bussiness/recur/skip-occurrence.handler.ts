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
    OccurrenceService 
} from "./occurrence.service"
import {
    SkipOccurrenceCommand, SkipOccurrenceCommandResult 
} from "./skip-occurrence.command"

@Injectable()
@CommandHandler(SkipOccurrenceCommand)
/** Decorated CQRS command handler; the bus dispatches to it and process() does the work (the abstract base keeps execute() a template). */
export class SkipOccurrenceHandler extends AbstractCommandHandler<SkipOccurrenceCommand, SkipOccurrenceCommandResult> {
    constructor(
    private readonly occurrenceService: OccurrenceService,
    ) {
        super()
    }

    protected override async process(command: SkipOccurrenceCommand): Promise<SkipOccurrenceCommandResult> {
        const { params } = command
        const occurrence = await this.occurrenceService.skip(params.occurrenceId,
            params.actorId)
        return {
            occurrenceId: occurrence.id, status: occurrence.status 
        }
    }
}
