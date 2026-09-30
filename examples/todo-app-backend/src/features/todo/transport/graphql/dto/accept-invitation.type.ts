import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The payload of acceptInvitation: the invitation id, the role that is active now and the status accepted. */
export class AcceptInvitationType {
    /** The invitation id. */
    @Field(() => ID)
    invitationId!: string

    /** The role that is active now. */
    @Field()
    role!: string

    /** The status: accepted. */
    @Field()
    status!: string
}
