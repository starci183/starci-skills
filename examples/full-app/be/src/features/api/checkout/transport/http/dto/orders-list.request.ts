import { Type } from "class-transformer"
import { IsIn, IsString, MaxLength, ValidateNested } from "class-validator"
import { OrdersListInput } from "./orders-list.input"

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
    @Type(() => OrdersListInput)
    input!: OrdersListInput
}
