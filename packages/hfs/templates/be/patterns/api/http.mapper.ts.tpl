import type { @@Action@@Request, @@Action@@Result } from "../../application/@@action@@.contracts"
import type { @@Action@@RequestDto } from "./dto/@@action@@.request"
import type { @@Action@@ResponseDto } from "./dto/@@action@@.response"

/** Maps the HTTP request to the command request. */
export const to@@Action@@Request = (input: @@Action@@RequestDto): @@Action@@Request => ({ id: input.id })

/** Maps the command result to the HTTP response. */
export const to@@Action@@Response = (result: @@Action@@Result): @@Action@@ResponseDto => ({ id: result.id })
