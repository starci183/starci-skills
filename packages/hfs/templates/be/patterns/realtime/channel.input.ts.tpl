import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** The @@channelCamel@@Changed arguments: what the caller follows. */
export class @@Channel@@Input {
    /** The id of the thing the caller follows. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    id!: string
}
