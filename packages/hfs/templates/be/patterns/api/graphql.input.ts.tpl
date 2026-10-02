import { Field, ID, InputType } from "@nestjs/graphql"
import { IsNotEmpty, IsString, MaxLength } from "class-validator"

@InputType()
/** The @@actionCamel@@ arguments: the id of the subject. */
export class @@Action@@Input {
    /** The id of the subject. */
    @Field(() => ID)
    @IsString()
    @IsNotEmpty()
    @MaxLength(64)
    id!: string
}
