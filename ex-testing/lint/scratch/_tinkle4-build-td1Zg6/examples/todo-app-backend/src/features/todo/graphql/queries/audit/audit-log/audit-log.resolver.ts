import {
    Context, Query, Resolver 
} from "@nestjs/graphql"
import {
    QueryBus 
} from "@nestjs/cqrs"
import {
    AuditLogQuery 
} from "@modules/bussiness/audit/audit-log.query"
import type {
    AuditLogQueryResult 
} from "@modules/bussiness/audit/audit-log.query"

import {
    SessionService 
} from "@modules/bussiness/session/session.service"

import {
    actorIdFromRequest, GraphqlRequestLike 
} from "../../../session-actor.adapter"
import {
    AuditLogLineResponse 
} from "./graphql-types/response"

/** fr.audit.log.read's GraphQL entry point. It hands the authenticated subject to the read and lets
 * AuditLogHandler decide the branch from the verified operator claim (AuditOperatorService, per
 * decision.audit.operator-role): a session actor the operator roster does not name - which is every actor
 * until a deployment configures one - reads only their own lines, exactly as before. The caller's role is
 * never threaded through here, so a request cannot ask for a broader read than its subject is verified for.
 * The action/target filter args remain the transport's to expose when the operator-facing UI lands; the
 * handler already applies them. */
@Resolver()
/** The fr.audit.log.read door: returns the caller's own audit lines, decrypted under their per-person key. */
export class AuditLogResolver {
    constructor(
    private readonly queryBus: QueryBus,
    private readonly sessionService: SessionService,
    ) {}

  @Query(() => [AuditLogLineResponse],
      {
          name: "auditLog", description: "The caller's own audit log lines, oldest first." 
      })
    async auditLog(@Context("req") req: GraphqlRequestLike): Promise<Array<AuditLogLineResponse>> {
        const personId = await actorIdFromRequest(req,
            this.sessionService)
        const result = await this.queryBus.execute<AuditLogQuery, AuditLogQueryResult>(
            new AuditLogQuery({
                personId 
            }),
        )
        return result.lines.map(line => new AuditLogLineResponse(line.at,
            line.action,
            line.target))
    }
}
