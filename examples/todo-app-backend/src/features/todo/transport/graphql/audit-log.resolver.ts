import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { AuditError } from "@modules/domain/audit"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { unwrapOutcome } from "@modules/platform/primitives"
import { AuditLogQuery } from "../../application/audit-log.query"
import { toAuditLogRequest, toAuditLogType } from "./audit-log.mapper"
import { AuditLogArgs } from "./dto/audit-log.args"
import { AuditLogType } from "./dto/audit-log.type"

@Resolver()
/** GraphQL door of auditLog. */
export class AuditLogResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** The audit lines the caller may read: their own, or the whole chain for an administrator. */
    @Query(() => [AuditLogType], { name: "auditLog" })
    async auditLog(@CurrentPrincipal() principal: Principal, @Args() args: AuditLogArgs): Promise<Array<AuditLogType>> {
        const outcome = await this.queryBus.execute(new AuditLogQuery({ request: toAuditLogRequest(args), principal }))
        return toAuditLogType(unwrapOutcome(outcome, AuditError))
    }
}
