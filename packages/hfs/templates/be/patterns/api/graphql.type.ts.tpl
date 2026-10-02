import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The @@actionCamel@@ answer. */
export class @@Action@@Type {
    /** The id of the subject. */
    @Field(() => ID)
    id!: string
}
