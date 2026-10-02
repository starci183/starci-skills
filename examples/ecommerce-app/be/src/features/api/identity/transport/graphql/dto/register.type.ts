import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The registered person: the id every person-keyed surface answers under. */
export class RegisterType {
    /** The new person id. */
    @Field(() => ID)
    personId!: string
}
