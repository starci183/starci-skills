import { Field, ID, InputType } from '@nestjs/graphql';
import { IsString, MinLength } from 'class-validator';

@InputType()
export class ReconcilePaymentInput {
  @Field(() => ID)
  @IsString()
  @MinLength(1)
  paymentIntentId!: string;
}
