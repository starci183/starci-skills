import { Field, InputType } from '@nestjs/graphql';
import { IsString, MinLength } from 'class-validator';

@InputType()
export class SignOutInput {
  @Field()
  @IsString()
  @MinLength(1)
  sessionToken!: string;
}
