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
    AuditErasureService 
} from "./audit-erasure.service"
import {
    CompleteErasureCommand, CompleteErasureCommandResult 
} from "./complete-erasure.command"

/** fr.audit.erasure.complete (composes br.audit.erasure.right, br.audit.erasure.logged). */
@Injectable()
@CommandHandler(CompleteErasureCommand)
/** Decorated CQRS command handler; the bus dispatches to it and process() does the work (the abstract base keeps execute() a template). */
export class CompleteErasureHandler extends AbstractCommandHandler<CompleteErasureCommand, CompleteErasureCommandResult> {
    constructor(
    private readonly erasureService: AuditErasureService,
    ) {
        super()
    }

    protected override async process(command: CompleteErasureCommand): Promise<CompleteErasureCommandResult> {
        const { params } = command
        const record = await this.erasureService.execute(params.requestId,
            params.callerId)
        return {
            requestId: record.requestId, state: record.state 
        }
    }
}
