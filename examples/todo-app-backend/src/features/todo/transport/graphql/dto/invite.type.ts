import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The payload of invite: the created invitation with the status pending. */
export class InviteType {
    /** The invitation id. */
    @Field(() => ID)
    invitationId!: string

    /** The task id. */
    @Field(() => ID)
    taskId!: string

    /** The invited address. */
    @Field()
    email!: string

    /** The role granted on accept. */
    @Field()
    role!: string

    /** The status: pending. */
    @Field()
    status!: string
}
