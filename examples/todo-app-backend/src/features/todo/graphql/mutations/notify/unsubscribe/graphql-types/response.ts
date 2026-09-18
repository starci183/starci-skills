import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class UnsubscribeResponse {
  @Field()
  channel!: string;

  @Field()
  unsubscribed!: boolean;

  constructor(channel: string, unsubscribed: boolean) {
    this.channel = channel;
    this.unsubscribed = unsubscribed;
  }
}
