import { Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { AuditErasureService } from './audit-erasure.service';
import { RequestErasureCommand, RequestErasureCommandResult } from './request-erasure.command';

/** fr.audit.erasure.request (composes br.audit.erasure.right, br.audit.erasure.logged). */
@Injectable()
@CommandHandler(RequestErasureCommand)
export class RequestErasureHandler implements ICommandHandler<RequestErasureCommand, RequestErasureCommandResult> {
  constructor(private readonly erasureService: AuditErasureService) {}

  async execute(command: RequestErasureCommand): Promise<RequestErasureCommandResult> {
    const record = await this.erasureService.request(command.params.personId);
    return { requestId: record.requestId, state: record.state };
  }
}
