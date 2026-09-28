import {
    Context, Query, Resolver 
} from "@nestjs/graphql"
import {
    QueryBus 
} from "@nestjs/cqrs"
import {
    ExportMyDataQuery,
} from "@modules/domain/audit/index"
import type {
    ExportMyDataQueryResult,
} from "@modules/domain/audit/index"

import {
    SessionService,
} from "@modules/domain/session/index"

import {
    actorIdFromRequest,
    GraphqlRequestLike,
} from "../../../../../session-actor.adapter"
import {
    ExportedLineResponse 
} from "./graphql-types/response"

/** fr.audit.export. Returns an empty list once a completed erasure has destroyed the caller's key. */
@Resolver()
/** The fr.audit.export door: the caller's audit lines as a portable export - the same decrypted lines auditLog reads. */
export class ExportMyDataResolver {
    constructor(
    private readonly queryBus: QueryBus,
    private readonly sessionService: SessionService,
    ) {}

  @Query(() => [ExportedLineResponse],
      {
          name: "exportMyData", description: "Every log line naming the caller, decrypted, or nothing once the caller's key has been erased." 
      })
    async exportMyData(@Context("req") req: GraphqlRequestLike): Promise<Array<ExportedLineResponse>> {
        const personId = await actorIdFromRequest(req,
            this.sessionService)
        const result = await this.queryBus.execute<ExportMyDataQuery, ExportMyDataQueryResult>(
            new ExportMyDataQuery({
                personId 
            }),
        )
        return result.lines.map(line => new ExportedLineResponse(line.at,
            line.action,
            line.target))
    }
}
