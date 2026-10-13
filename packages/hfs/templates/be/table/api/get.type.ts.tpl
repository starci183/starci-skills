import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The get-{{singular}} answer. */
export class Get{{Singular}}Type {
    /** The id of the {{singular}} row. */
    @Field(() => ID)
    id!: string
}
