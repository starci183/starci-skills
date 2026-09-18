import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AuditLogLineResponse {
  @Field(() => Date)
  at!: Date;

  @Field()
  action!: string;

  @Field(() => String, { nullable: true })
  target!: string | null;

  constructor(at: Date, action: string, target: string | null) {
    this.at = at;
    this.action = action;
    this.target = target;
  }
}
