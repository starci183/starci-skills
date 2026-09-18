import { Field, ID, InputType } from '@nestjs/graphql';
import { IsString, MinLength } from 'class-validator';

@InputType()
export class AcceptInvitationInput {
  @Field(() => ID)
  @IsString()
  invitationId!: string;

  @Field()
  @IsString()
  @MinLength(1)
  email!: string;
}
