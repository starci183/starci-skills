import { Injectable } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { RecurRuleForbiddenException } from '@modules/shared/exceptions';
import { RuleService } from './rule.service';
import { OccurrenceService } from './occurrence.service';
import { addDays, datesForRule } from './calendar.util';
import { localDateInZone } from './zone.util';
import { UpcomingOccurrencesQuery, UpcomingOccurrencesQueryResult } from './upcoming-occurrences.query';

const DEFAULT_PREVIEW_DAYS = 14;

/**
 * fr.recur.see-upcoming: materialised occurrences are read from the store; the preview of dates the
 * rule will next fire on is computed live from the rule's own shape (`calendar.util.datesForRule`),
 * never read from a stored row - "scheduled" is not a row (sds.recur.occurrence-lifecycle). An ended
 * rule's preview is always empty, only its history remains.
 */
@Injectable()
@QueryHandler(UpcomingOccurrencesQuery)
export class UpcomingOccurrencesHandler implements IQueryHandler<UpcomingOccurrencesQuery, UpcomingOccurrencesQueryResult> {
  constructor(
    private readonly ruleService: RuleService,
    private readonly occurrenceService: OccurrenceService,
  ) {}

  async execute(query: UpcomingOccurrencesQuery): Promise<UpcomingOccurrencesQueryResult> {
    const { params } = query;
    const rule = await this.ruleService.findById(params.ruleId);
    if (rule.owner !== params.actorId) {
      throw new RecurRuleForbiddenException({ ruleId: params.ruleId, actorId: params.actorId });
    }

    const occurrences = await this.occurrenceService.listByRule(params.ruleId);
    const materialised = occurrences.map(occurrence => ({
      occurrenceId: occurrence.id,
      localDate: occurrence.localDate,
      dueAtUtc: occurrence.dueAtUtc.toISOString(),
      status: occurrence.status,
    }));

    let previewDates: string[] = [];
    if (rule.endedAt === null) {
      const today = localDateInZone(rule.timeZone, new Date());
      const horizon = addDays(today, (params.previewDays ?? DEFAULT_PREVIEW_DAYS) - 1);
      previewDates = datesForRule(
        { frequency: rule.frequency, n: rule.n, dayOfMonth: rule.dayOfMonth, startDate: rule.startDate },
        today,
        horizon,
      );
    }

    return { ruleId: rule.id, materialised, previewDates };
  }
}
