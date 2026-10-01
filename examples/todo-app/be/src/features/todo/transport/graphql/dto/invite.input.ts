import { Field, ID, InputType } from "@nestjs/graphql"
import { IsString, MaxLength, MinLength } from "class-validator"

@InputType()
/** The invite arguments: the task, the invitee's email and the role to grant on accept. */
export class InviteInput {
    /** The task id. */
    @Field(() => ID)
    @IsString()
    @MinLength(1)
    @MaxLength(128)
    taskId!: string

    /** The address to invite. */
    @Field()
    @IsString()
    @MinLength(1)
    @MaxLength(320)
    email!: string

    /** The role to grant: viewer or editor. Deliberately not an enum here, the share capability refuses any other role once, with its own code. */
    @Field()
    @IsString()
    @MinLength(1)
    @MaxLength(32)
    role!: string
}
