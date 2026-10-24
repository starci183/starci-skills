import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator"
import { PAGE_SIZE_MAX } from "@modules/platform/database"
import { CURSOR_LENGTH_MAX } from "@modules/platform/primitives"

/** The input of `orders.list@1`: how many orders to read and the cursor of the page before. */
export class OrdersListInput {
    /** The page size, from 1 up to the biggest page. */
    @IsInt()
    @Min(1)
    @Max(PAGE_SIZE_MAX)
    first!: number

    /** The `endCursor` of the page before; absent or null for the first page. */
    @IsOptional()
    @IsString()
    @MaxLength(CURSOR_LENGTH_MAX)
    after?: string | null
}
