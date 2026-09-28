import {
    Field, ID, InputType 
} from "@nestjs/graphql"
import {
    IsString, MinLength 
} from "class-validator"

@InputType()
/** acceptInvitation's argument: the invitationId plus the invitee's own email - the accept call binds them together. */
export class AcceptInvitationInput {
  @Field(() => ID)
  @IsString()
      invitationId!: string

  @Field()
  @IsString()
  @MinLength(1)
      email!: string
}
