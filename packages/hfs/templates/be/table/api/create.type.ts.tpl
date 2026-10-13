import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The create-{{singular}} answer. */
export class Create{{Singular}}Type {
    /** The id of the new {{singular}} row. */
    @Field(() => ID)
    id!: string
}
