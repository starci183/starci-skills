import { Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PreferencesService } from './preferences.service';
import {
  UpdateNotificationPreferencesCommand,
  UpdateNotificationPreferencesCommandResult,
} from './update-notification-preferences.command';

@Injectable()
@CommandHandler(UpdateNotificationPreferencesCommand)
export class UpdateNotificationPreferencesHandler
  implements ICommandHandler<UpdateNotificationPreferencesCommand, UpdateNotificationPreferencesCommandResult>
{
  constructor(private readonly preferences: PreferencesService) {}

  async execute(command: UpdateNotificationPreferencesCommand): Promise<UpdateNotificationPreferencesCommandResult> {
    const { params } = command;
    const record = await this.preferences.update(params.actorId, params.channel, {
      unsubscribed: params.unsubscribed,
      digestWindowMinutes: params.digestWindowMinutes,
    });
    return { channel: record.channel, unsubscribed: record.unsubscribed, digestWindowMinutes: record.digestWindowMinutes };
  }
}
