import { IsString, MaxLength } from "class-validator"

/** The delivery the calendar notifier sends, as the validation pipe builds it: the fields the intake reads, bounded; add the provider's other fields here. */
export class CalendarRequest {
    /** The provider's id of this delivery: the dedupe key of the intake. */
    @IsString()
    @MaxLength(64)
    id!: string
}
