import {
    Field, ID, InputType 
} from "@nestjs/graphql"
import {
    IsString 
} from "class-validator"

@InputType()
/** revokeCollaborator's argument: the invitationId the owner revokes. */
export class RevokeCollaboratorInput {
  @Field(() => ID)
  @IsString()
      invitationId!: string
}
