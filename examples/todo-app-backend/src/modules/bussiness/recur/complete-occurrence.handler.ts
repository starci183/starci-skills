import { Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OccurrenceService } from './occurrence.service';
import { CompleteOccurrenceCommand, CompleteOccurrenceCommandResult } from './complete-occurrence.command';

@Injectable()
@CommandHandler(CompleteOccurrenceCommand)
export class CompleteOccurrenceHandler implements ICommandHandler<CompleteOccurrenceCommand, CompleteOccurrenceCommandResult> {
  constructor(private readonly occurrenceService: OccurrenceService) {}

  async execute(command: CompleteOccurrenceCommand): Promise<CompleteOccurrenceCommandResult> {
    const { params } = command;
    const occurrence = await this.occurrenceService.complete(params.occurrenceId, params.actorId);
    return { occurrenceId: occurrence.id, status: occurrence.status };
  }
}
