import { IsNotEmpty, IsString, MaxLength } from "class-validator"

/** The bounded HTTP request of @@actionCamel@@. */
export class @@Action@@RequestDto {
    /** The id of the subject. */
    @IsString()
    @IsNotEmpty()
    @MaxLength(64)
    id!: string
}
