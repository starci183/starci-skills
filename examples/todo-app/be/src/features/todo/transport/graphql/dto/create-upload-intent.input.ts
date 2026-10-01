import { Field, InputType, Int } from "@nestjs/graphql"
import { IsInt, IsString, MaxLength, Min, MinLength } from "class-validator"

@InputType()
/** The createUploadIntent arguments: the declared shape of the file. */
export class CreateUploadIntentInput {
    /** The file name. */
    @Field()
    @IsString()
    @MinLength(1)
    @MaxLength(255)
    filename!: string

    /** The declared media type, for example text/plain. */
    @Field()
    @IsString()
    @MinLength(1)
    @MaxLength(255)
    mime!: string

    /** The declared size in bytes. */
    @Field(() => Int)
    @IsInt()
    @Min(1)
    sizeBytes!: number
}
