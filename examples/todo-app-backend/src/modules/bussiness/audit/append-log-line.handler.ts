import { Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { AuditLogService } from './audit-log.service';
import { AppendLogLineCommand, AppendLogLineCommandResult } from './append-log-line.command';

/** fr.audit.log.append / sds.audit.log-chain's t-append. */
@Injectable()
@CommandHandler(AppendLogLineCommand)
export class AppendLogLineHandler implements ICommandHandler<AppendLogLineCommand, AppendLogLineCommandResult> {
  constructor(private readonly logService: AuditLogService) {}

  async execute(command: AppendLogLineCommand): Promise<AppendLogLineCommandResult> {
    const { params } = command;
    const line = await this.logService.append(params.actorId, params.action, params.target ?? null);
    return { lineId: line.id };
  }
}
