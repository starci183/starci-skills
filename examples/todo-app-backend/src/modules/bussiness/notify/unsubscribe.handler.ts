import { Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PreferencesService } from './preferences.service';
import { UnsubscribeCommand, UnsubscribeCommandResult } from './unsubscribe.command';

/** br.notify.unsubscribe.honored: unsubscribing is per person and per channel, and takes effect for
 * every event enqueued after it, immediately - `PreferencesService.setUnsubscribed` is read by
 * `NotifyService.admit` on every admission, so there is no separate cache to invalidate. */
@Injectable()
@CommandHandler(UnsubscribeCommand)
export class UnsubscribeHandler implements ICommandHandler<UnsubscribeCommand, UnsubscribeCommandResult> {
  constructor(private readonly preferences: PreferencesService) {}

  async execute(command: UnsubscribeCommand): Promise<UnsubscribeCommandResult> {
    const { params } = command;
    await this.preferences.setUnsubscribed(params.actorId, params.channel, true);
    return { channel: params.channel, unsubscribed: true };
  }
}
