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
    RequestErasureCommand, RequestErasureCommandResult 
} from "./request-erasure.command"

/** fr.audit.erasure.request (composes br.audit.erasure.right, br.audit.erasure.logged). */
@Injectable()
@CommandHandler(RequestErasureCommand)
/** Decorated CQRS command handler; the bus dispatches to it and process() does the work (the abstract base keeps execute() a template). */
export class RequestErasureHandler extends AbstractCommandHandler<RequestErasureCommand, RequestErasureCommandResult> {
    constructor(
    private readonly erasureService: AuditErasureService,
    ) {
        super()
    }

    protected override async process(command: RequestErasureCommand): Promise<RequestErasureCommandResult> {
        const record = await this.erasureService.request(command.params.personId)
        return {
            requestId: record.requestId, state: record.state 
        }
    }
}
