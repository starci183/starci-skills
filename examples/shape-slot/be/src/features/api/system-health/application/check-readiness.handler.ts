import { QueryHandler } from "@nestjs/cqrs"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectDatabaseReadiness } from "@modules/platform/database"
import type { DatabaseReadinessReport, DatabaseReadinessService } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CheckReadinessQuery } from "./check-readiness.query"

@QueryHandler(CheckReadinessQuery)
/** Answers readiness by probing the required primary connection; it never aliases the local liveness report. */
export class CheckReadinessHandler extends ICQRSHandler<CheckReadinessQuery, DatabaseReadinessReport> {
    constructor(
        @InjectLogger() logger: Logger,
        @InjectDatabaseReadiness() private readonly readiness: DatabaseReadinessService,
    ) {
        super(logger)
    }

    protected override process(): Promise<DatabaseReadinessReport> {
        return this.readiness.check()
    }
}
