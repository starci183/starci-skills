import { Field, InputType } from '@nestjs/graphql';
import { IsString, MinLength } from 'class-validator';

@InputType()
export class UnsubscribeInput {
  @Field({ defaultValue: 'email' })
  @IsString()
  @MinLength(1)
  channel!: string;
}
