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
    AuditLogService 
} from "./audit-log.service"
import {
    AppendLogLineCommand, AppendLogLineCommandResult 
} from "./append-log-line.command"

/** fr.audit.log.append / sds.audit.log-chain's t-append. */
@Injectable()
@CommandHandler(AppendLogLineCommand)
/** Decorated CQRS command handler; the bus dispatches to it and process() does the work (the abstract base keeps execute() a template). */
export class AppendLogLineHandler extends AbstractCommandHandler<AppendLogLineCommand, AppendLogLineCommandResult> {
    constructor(
    private readonly logService: AuditLogService,
    ) {
        super()
    }

    protected override async process(command: AppendLogLineCommand): Promise<AppendLogLineCommandResult> {
        const { params } = command
        const line = await this.logService.append(params.actorId,
            params.action,
            params.target ?? null)
        return {
            lineId: line.id 
        }
    }
}
