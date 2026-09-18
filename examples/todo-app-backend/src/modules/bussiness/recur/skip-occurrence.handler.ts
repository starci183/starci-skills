import { Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OccurrenceService } from './occurrence.service';
import { SkipOccurrenceCommand, SkipOccurrenceCommandResult } from './skip-occurrence.command';

@Injectable()
@CommandHandler(SkipOccurrenceCommand)
export class SkipOccurrenceHandler implements ICommandHandler<SkipOccurrenceCommand, SkipOccurrenceCommandResult> {
  constructor(private readonly occurrenceService: OccurrenceService) {}

  async execute(command: SkipOccurrenceCommand): Promise<SkipOccurrenceCommandResult> {
    const { params } = command;
    const occurrence = await this.occurrenceService.skip(params.occurrenceId, params.actorId);
    return { occurrenceId: occurrence.id, status: occurrence.status };
  }
}
