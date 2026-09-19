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
    AuditLogService 
} from "./audit-log.service"
import {
    ExportMyDataQuery, ExportMyDataQueryResult, ExportedLineResult 
} from "./export-my-data.query"

/** fr.audit.export. */
@Injectable()
@QueryHandler(ExportMyDataQuery)
/** Decorated CQRS query handler; the bus dispatches to it and process() does the work (the abstract base keeps execute() a template). */
export class ExportMyDataHandler extends AbstractQueryHandler<ExportMyDataQuery, ExportMyDataQueryResult> {
    constructor(
    private readonly logService: AuditLogService,
    ) {
        super()
    }

    protected override async process(query: ExportMyDataQuery): Promise<ExportMyDataQueryResult> {
        const records = await this.logService.exportForPerson(query.params.personId)
        const lines: Array<ExportedLineResult> = records.map(record => ({
            at: record.at,
            action: record.action,
            target: record.target,
        }))
        return {
            lines 
        }
    }
}
