import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class MaterialisedOccurrenceResponse {
  @Field(() => ID)
  occurrenceId!: string;

  @Field()
  localDate!: string;

  @Field()
  dueAtUtc!: string;

  @Field()
  status!: string;

  constructor(occurrenceId: string, localDate: string, dueAtUtc: string, status: string) {
    this.occurrenceId = occurrenceId;
    this.localDate = localDate;
    this.dueAtUtc = dueAtUtc;
    this.status = status;
  }
}

@ObjectType()
export class UpcomingOccurrencesResponse {
  @Field(() => ID)
  ruleId!: string;

  @Field(() => [MaterialisedOccurrenceResponse])
  materialised!: MaterialisedOccurrenceResponse[];

  @Field(() => [String], { description: 'Dates the rule will next fire on, computed live. Empty for an ended rule.' })
  previewDates!: string[];

  constructor(ruleId: string, materialised: MaterialisedOccurrenceResponse[], previewDates: string[]) {
    this.ruleId = ruleId;
    this.materialised = materialised;
    this.previewDates = previewDates;
  }
}
