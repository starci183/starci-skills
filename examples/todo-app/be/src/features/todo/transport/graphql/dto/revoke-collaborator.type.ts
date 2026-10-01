import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The payload of revokeCollaborator: the invitation id and the status revoked. */
export class RevokeCollaboratorType {
    /** The invitation id. */
    @Field(() => ID)
    invitationId!: string

    /** The status: revoked. */
    @Field()
    status!: string
}
