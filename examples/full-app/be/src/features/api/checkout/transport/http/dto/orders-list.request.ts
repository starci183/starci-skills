import { Type } from "class-transformer"
import { IsInt, IsIn, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from "class-validator"
import { PAGE_SIZE_MAX } from "@modules/platform/database"
import { CURSOR_LENGTH_MAX } from "@modules/platform/primitives"

/** The input of `orders.list@1`: how many orders to read and the cursor of the page before. */
export class OrdersListInputRequest {
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

/** The body of the operation route for `orders.list@1`, as a class so the pipe can validate it at run time. */
export class OrdersListRequest {
    /** The operation the body asks for: the one this table serves. */
    @IsIn(["orders.list@1"])
    operation!: "orders.list@1"

    /** The caller's id for this request, echoed in the answer. */
    @IsString()
    @MaxLength(64)
    requestId!: string

    /** The input of the operation. */
    @ValidateNested()
    @Type(() => OrdersListInputRequest)
    input!: OrdersListInputRequest
}
