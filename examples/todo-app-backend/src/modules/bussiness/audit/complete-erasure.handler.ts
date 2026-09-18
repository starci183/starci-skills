import { Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { AuditErasureService } from './audit-erasure.service';
import { CompleteErasureCommand, CompleteErasureCommandResult } from './complete-erasure.command';

/** fr.audit.erasure.complete (composes br.audit.erasure.right, br.audit.erasure.logged). */
@Injectable()
@CommandHandler(CompleteErasureCommand)
export class CompleteErasureHandler implements ICommandHandler<CompleteErasureCommand, CompleteErasureCommandResult> {
  constructor(private readonly erasureService: AuditErasureService) {}

  async execute(command: CompleteErasureCommand): Promise<CompleteErasureCommandResult> {
    const { params } = command;
    const record = await this.erasureService.execute(params.requestId, params.callerId);
    return { requestId: record.requestId, state: record.state };
  }
}
