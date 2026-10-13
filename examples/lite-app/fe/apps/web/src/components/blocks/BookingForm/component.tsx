import { Button, ButtonGroup, Form, Input, SectionHeader, Text } from "@starci/grammar/common"

/** One controlled field as data: its value and its validation message. */
interface BookingFieldState {
    readonly value: string
    readonly errorMessage?: string
}

/** Copy, fields, state and actions for the resource, calendar and booking commands. */
export interface BookingFormBaseProps {
    readonly props: {
        readonly title: string
        readonly commandsLabel: string
        readonly addResourceLabel: string
        readonly addCalendarLabel: string
        readonly resourcePending: boolean
        readonly calendarPending: boolean
        readonly lastResource?: string
        readonly lastCalendar?: string
        readonly bookingTitle: string
        readonly resourceLabel: string
        readonly startsAtLabel: string
        readonly endsAtLabel: string
        readonly submitLabel: string
        readonly bookingPending: boolean
        readonly bookingStatus?: string
        readonly resourceId: BookingFieldState
        readonly startsAt: BookingFieldState
        readonly endsAt: BookingFieldState
    }
    readonly on: {
        readonly addResource: () => void
        readonly addCalendar: () => void
        readonly book: () => void
        readonly resourceIdChange: (value: string) => void
        readonly resourceIdBlur: () => void
        readonly startsAtChange: (value: string) => void
        readonly startsAtBlur: () => void
        readonly endsAtChange: (value: string) => void
        readonly endsAtBlur: () => void
    }
}

/** What one controlled booking input takes. */
interface BookingInputProps {
    readonly id: string
    readonly name: string
    readonly label: string
    readonly placeholder?: string
    readonly field: BookingFieldState
    readonly onChange: (value: string) => void
    readonly onBlur: () => void
}

/** One controlled grammar Input of the booking form. */
const BookingInput = (props: BookingInputProps) => (
    <Input
        id={props.id}
        name={props.name}
        label={props.label}
        placeholder={props.placeholder}
        isRequired
        value={props.field.value}
        onValueChange={props.onChange}
        onBlur={props.onBlur}
        errorMessage={props.field.errorMessage}
        isError={props.field.errorMessage !== undefined}
    />
)

/** Draws the signed-in booking workspace without reading copy, session or back-end state. */
export const BookingFormBase = (props: BookingFormBaseProps) => (
    <>
        <SectionHeader title={props.props.title} level={2} />
        <ButtonGroup label={props.props.commandsLabel}>
            <Button variant="secondary" isPending={props.props.resourcePending} onPress={props.on.addResource}>
                {props.props.addResourceLabel}
            </Button>
            <Button variant="secondary" isPending={props.props.calendarPending} onPress={props.on.addCalendar}>
                {props.props.addCalendarLabel}
            </Button>
        </ButtonGroup>
        {props.props.lastResource === undefined ? null : <Text live="polite">{props.props.lastResource}</Text>}
        {props.props.lastCalendar === undefined ? null : <Text live="polite">{props.props.lastCalendar}</Text>}
        <SectionHeader title={props.props.bookingTitle} level={3} />
        <Form label={props.props.bookingTitle} isPending={props.props.bookingPending} onSubmit={props.on.book}>
            <BookingInput
                id="booking-resource-id"
                name="resourceId"
                label={props.props.resourceLabel}
                field={props.props.resourceId}
                onChange={props.on.resourceIdChange}
                onBlur={props.on.resourceIdBlur}
            />
            <BookingInput
                id="booking-starts-at"
                name="startsAt"
                label={props.props.startsAtLabel}
                placeholder="2026-10-04T09:00:00Z"
                field={props.props.startsAt}
                onChange={props.on.startsAtChange}
                onBlur={props.on.startsAtBlur}
            />
            <BookingInput
                id="booking-ends-at"
                name="endsAt"
                label={props.props.endsAtLabel}
                placeholder="2026-10-04T10:00:00Z"
                field={props.props.endsAt}
                onChange={props.on.endsAtChange}
                onBlur={props.on.endsAtBlur}
            />
            {props.props.bookingStatus === undefined ? null : <Text live="polite">{props.props.bookingStatus}</Text>}
            <Button type="submit" variant="primary" isPending={props.props.bookingPending}>
                {props.props.submitLabel}
            </Button>
        </Form>
    </>
)
