import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class NotificationPreferencesResponse {
  @Field()
  channel!: string;

  @Field()
  unsubscribed!: boolean;

  @Field(() => Int, { nullable: true })
  digestWindowMinutes!: number | null;

  constructor(channel: string, unsubscribed: boolean, digestWindowMinutes: number | null) {
    this.channel = channel;
    this.unsubscribed = unsubscribed;
    this.digestWindowMinutes = digestWindowMinutes;
  }
}
