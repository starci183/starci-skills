import { Field, ID, InputType } from '@nestjs/graphql';
import { IsString } from 'class-validator';

@InputType()
export class RevokeCollaboratorInput {
  @Field(() => ID)
  @IsString()
  invitationId!: string;
}
