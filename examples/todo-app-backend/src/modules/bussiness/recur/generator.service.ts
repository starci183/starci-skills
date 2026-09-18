import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { CreateTaskCommand, CreateTaskCommandResult } from '@modules/bussiness/task';
import { datesForRule } from './calendar.util';
import { localDateInZone, resolveRuleInstant } from './zone.util';
import { RuleService } from './rule.service';
import { OccurrenceService } from './occurrence.service';
import { RuleRecord } from './types/rule-record';
import { OccurrenceRecord } from './types/occurrence-record';

export interface GenerationSummary {
  readonly materialised: OccurrenceRecord[];
}

/**
 * sds.recur.generation-engine's own responsibility statement made real: walks a rule's dates between its
 * `startDate` and "today" (in the rule's own zone, at tick time), resolving each to a UTC instant and
 * materialising the ones not yet written. Walking from `startDate` every run rather than tracking a
 * separate "last generated" cursor is decision.recur.generation.backfill made structural instead of
 * conditional: a missed window is not detected and specially replayed, it is simply part of the range
 * this run always covers, and `OccurrenceService.existsByWindowKey` is what makes covering it twice free
 * (br.recur.generation.once). Ending a rule (data.recur.rule.endedAt) caps the walk so "no occurrence
 * dated after the day it ended" is a property of the range itself, not a filter applied afterward.
 *
 * Materialising a date always goes through `CommandBus.execute(new CreateTaskCommand(...))` - the same
 * command the task capability's own create-task flow dispatches - so `TaskCreationPolicyRegistry` sees
 * every occurrence exactly like any other task and `event.task.created` still fires for it.
 */
@Injectable()
export class GeneratorService {
  constructor(
    private readonly ruleService: RuleService,
    private readonly occurrenceService: OccurrenceService,
    private readonly commandBus: CommandBus,
  ) {}

  async runOnce(now: Date = new Date()): Promise<GenerationSummary> {
    const rules = await this.ruleService.listActive();
    const materialised: OccurrenceRecord[] = [];
    for (const rule of rules) {
      materialised.push(...(await this.runForRule(rule, now)));
    }
    return { materialised };
  }

  async runForRule(rule: RuleRecord, now: Date): Promise<OccurrenceRecord[]> {
    const todayLocalDate = localDateInZone(rule.timeZone, now);
    const horizon = rule.endedAt !== null && rule.endedAt < todayLocalDate ? rule.endedAt : todayLocalDate;
    const dates = datesForRule(
      { frequency: rule.frequency, n: rule.n, dayOfMonth: rule.dayOfMonth, startDate: rule.startDate },
      rule.startDate,
      horizon,
    );

    const materialised: OccurrenceRecord[] = [];
    for (const localDate of dates) {
      const windowKey = `${rule.id}:${localDate}`;
      if (await this.occurrenceService.existsByWindowKey(windowKey)) {
        continue;
      }
      const resolution = resolveRuleInstant(rule.timeZone, localDate, rule.time);
      const createdTask = await this.commandBus.execute<CreateTaskCommand, CreateTaskCommandResult>(
        new CreateTaskCommand({ ownerId: rule.owner, title: rule.title }),
      );
      const occurrence = await this.occurrenceService.materialise({
        id: createdTask.taskId,
        ruleId: rule.id,
        windowKey,
        localDate,
        dueAtUtc: resolution.instant,
      });
      materialised.push(occurrence);
    }
    return materialised;
  }
}
