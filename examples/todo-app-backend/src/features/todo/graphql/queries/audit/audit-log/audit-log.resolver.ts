import { Context, Query, Resolver } from '@nestjs/graphql';
import { QueryBus } from '@nestjs/cqrs';
import { AuditLogQuery, AuditLogQueryResult } from '@modules/bussiness/audit';
import { SessionService } from '@modules/bussiness/session';
import { actorIdFromRequest, GraphqlRequestLike } from '../../../session-actor.adapter';
import { AuditLogLineResponse } from './graphql-types/response';

/** gap.audit.operator-role stays todo: this returns the caller's own lines only, never anyone else's -
 * see audit-log.query.ts's comment for why this is narrower than fr.audit.log.read's own mainFlow. */
@Resolver()
export class AuditLogResolver {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly sessionService: SessionService,
  ) {}

  @Query(() => [AuditLogLineResponse], { name: 'auditLog', description: "The caller's own audit log lines, oldest first." })
  async auditLog(@Context('req') req: GraphqlRequestLike): Promise<AuditLogLineResponse[]> {
    const personId = await actorIdFromRequest(req, this.sessionService);
    const result = await this.queryBus.execute<AuditLogQuery, AuditLogQueryResult>(
      new AuditLogQuery({ personId }),
    );
    return result.lines.map(line => new AuditLogLineResponse(line.at, line.action, line.target));
  }
}
