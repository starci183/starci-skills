import { Module } from '@nestjs/common';
import { PlatformEventBus } from './event-bus.providers';

/**
 * The platform events module: every feature that produces or consumes a domain event imports this module
 * and depends only on the exported PlatformEventBus port, never on another feature's module.
 */
@Module({
  providers: [PlatformEventBus],
  exports: [PlatformEventBus],
})
export class PlatformEventsModule {}
