import { Field, ID, InputType } from "@nestjs/graphql"
import { IsString, MaxLength, MinLength } from "class-validator"

@InputType()
/** The revokeCollaborator arguments: the id of the invitation the owner revokes. */
export class RevokeCollaboratorInput {
    /** The invitation id. */
    @Field(() => ID)
    @IsString()
    @MinLength(1)
    @MaxLength(128)
    invitationId!: string
}
