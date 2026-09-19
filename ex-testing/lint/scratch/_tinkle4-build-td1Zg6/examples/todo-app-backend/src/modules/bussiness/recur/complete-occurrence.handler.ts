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
    CompleteOccurrenceCommand, CompleteOccurrenceCommandResult 
} from "./complete-occurrence.command"

@Injectable()
@CommandHandler(CompleteOccurrenceCommand)
/** Decorated CQRS command handler; the bus dispatches to it and process() does the work (the abstract base keeps execute() a template). */
export class CompleteOccurrenceHandler extends AbstractCommandHandler<CompleteOccurrenceCommand, CompleteOccurrenceCommandResult> {
    constructor(
    private readonly occurrenceService: OccurrenceService,
    ) {
        super()
    }

    protected override async process(command: CompleteOccurrenceCommand): Promise<CompleteOccurrenceCommandResult> {
        const { params } = command
        const occurrence = await this.occurrenceService.complete(params.occurrenceId,
            params.actorId)
        return {
            occurrenceId: occurrence.id, status: occurrence.status 
        }
    }
}
