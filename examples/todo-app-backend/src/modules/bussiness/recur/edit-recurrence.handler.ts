import { Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RuleService } from './rule.service';
import { EditRecurrenceCommand, EditRecurrenceCommandResult } from './edit-recurrence.command';

/**
 * fr.recur.edit-rule composes br.recur.occurrence.owned-by-rule-owner's own owner check (here, over the
 * rule rather than an occurrence): only the rule's owner may edit it. Already-materialised occurrences
 * are never touched by this handler - GeneratorService only ever reads the rule's current shape the next
 * time it walks dates, so "occurrences not yet materialised are generated from the new rule" is simply
 * what happens on the next run, not something this handler does.
 */
@Injectable()
@CommandHandler(EditRecurrenceCommand)
export class EditRecurrenceHandler implements ICommandHandler<EditRecurrenceCommand, EditRecurrenceCommandResult> {
  constructor(private readonly ruleService: RuleService) {}

  async execute(command: EditRecurrenceCommand): Promise<EditRecurrenceCommandResult> {
    const { params } = command;
    const rule = await this.ruleService.edit(params.ruleId, params.actorId, {
      frequency: params.frequency,
      n: params.n,
      dayOfMonth: params.dayOfMonth,
      timeZone: params.timeZone,
      time: params.time,
    });
    return { ruleId: rule.id, frequency: rule.frequency, timeZone: rule.timeZone, time: rule.time };
  }
}
