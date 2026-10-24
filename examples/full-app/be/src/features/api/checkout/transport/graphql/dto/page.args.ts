import { ArgsType, Field, Int } from "@nestjs/graphql"
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator"
import { PAGE_SIZE_MAX } from "@modules/platform/database"
import { CURSOR_LENGTH_MAX } from "@modules/platform/primitives"

@ArgsType()
/** The arguments of every paginated list: how many items to read and the cursor of the page before. */
export class PageArgs {
    /** The page size, from 1 up to the biggest page. */
    @Field(() => Int)
    @IsInt()
    @Min(1)
    @Max(PAGE_SIZE_MAX)
    first!: number

    /** The `endCursor` of the page before; absent for the first page. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(CURSOR_LENGTH_MAX)
    after?: string | null
}
