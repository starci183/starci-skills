import { Injectable } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PreferencesService } from './preferences.service';
import { NotificationPreferencesQuery, NotificationPreferencesQueryResult } from './notification-preferences.query';

@Injectable()
@QueryHandler(NotificationPreferencesQuery)
export class NotificationPreferencesHandler
  implements IQueryHandler<NotificationPreferencesQuery, NotificationPreferencesQueryResult>
{
  constructor(private readonly preferences: PreferencesService) {}

  async execute(query: NotificationPreferencesQuery): Promise<NotificationPreferencesQueryResult> {
    const record = await this.preferences.get(query.params.actorId, query.params.channel);
    return { channel: record.channel, unsubscribed: record.unsubscribed, digestWindowMinutes: record.digestWindowMinutes };
  }
}
