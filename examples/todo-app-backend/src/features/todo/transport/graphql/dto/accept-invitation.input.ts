import { Field, ID, InputType } from "@nestjs/graphql"
import { IsString, MaxLength, MinLength } from "class-validator"

@InputType()
/** The acceptInvitation arguments: the invitation id plus the invitee's own email, which the accept call binds together. */
export class AcceptInvitationInput {
    /** The invitation id. */
    @Field(() => ID)
    @IsString()
    @MinLength(1)
    @MaxLength(128)
    invitationId!: string

    /** The accepting person's own email. */
    @Field()
    @IsString()
    @MinLength(1)
    @MaxLength(320)
    email!: string
}
