import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One invitation of the collaborators query: id, email, role and live status. */
export class ListCollaboratorsType {
    /** The invitation id. */
    @Field(() => ID)
    invitationId!: string

    /** The invited address. */
    @Field()
    email!: string

    /** The role. */
    @Field()
    role!: string

    /** The live status. */
    @Field()
    status!: string
}
