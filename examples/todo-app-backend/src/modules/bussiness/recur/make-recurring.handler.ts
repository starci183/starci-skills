import { Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RuleService } from './rule.service';
import { MakeRecurringCommand, MakeRecurringCommandResult } from './make-recurring.command';

/**
 * fr.recur.make-recurring: creates exactly one recurrence rule owned by the submitter. A day-of-month
 * rule naming a day that does not exist every month (e.g. the 31st) is accepted unconditionally here -
 * decision.recur.impossible-date's refusal-at-creation option was rejected, so this handler never
 * inspects `dayOfMonth` against any particular month's length; only RuleService's own shape invariant
 * (data.recur.rule: dayOfMonth required and 1-31 for monthly-day, n required and positive for
 * every-n-days) can refuse a submission here.
 */
@Injectable()
@CommandHandler(MakeRecurringCommand)
export class MakeRecurringHandler implements ICommandHandler<MakeRecurringCommand, MakeRecurringCommandResult> {
  constructor(private readonly ruleService: RuleService) {}

  async execute(command: MakeRecurringCommand): Promise<MakeRecurringCommandResult> {
    const { params } = command;
    const rule = await this.ruleService.create({
      owner: params.ownerId,
      title: params.title,
      frequency: params.frequency,
      n: params.n ?? null,
      dayOfMonth: params.dayOfMonth ?? null,
      timeZone: params.timeZone,
      time: params.time,
      startDate: params.startDate,
    });
    return {
      ruleId: rule.id,
      title: rule.title,
      frequency: rule.frequency,
      timeZone: rule.timeZone,
      time: rule.time,
      startDate: rule.startDate,
    };
  }
}
