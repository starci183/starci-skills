import { Button, ButtonGroup, Form, SectionHeader, Text } from "@starci/grammar/common"
import { FormInput } from "@/components/composites/FormInput"
import type { FormInputField, FormInputSpec } from "@/components/composites/FormInput"

/** Copy, fields, state and actions for the resource, calendar and booking commands. */
export interface BookingFormBaseProps {
    readonly props: {
        readonly title: string
        readonly commandsLabel: string
        readonly addResourceLabel: string
        readonly addCalendarLabel: string
        readonly resourcePending: boolean
        readonly calendarPending: boolean
        readonly lastResource: string | undefined
        readonly lastCalendar: string | undefined
        readonly bookingTitle: string
        readonly submitLabel: string
        readonly bookingPending: boolean
        readonly bookingStatus: string | undefined
        readonly resourceId: FormInputField
        readonly startsAt: FormInputField
        readonly endsAt: FormInputField
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

/** The resource input of the booking form. */
const RESOURCE_ID: FormInputSpec = { id: "booking-resource-id", name: "resourceId" }

/** The start input of the booking form, with an example UTC timestamp. */
const STARTS_AT: FormInputSpec = { id: "booking-starts-at", name: "startsAt", placeholder: "2026-10-04T09:00:00Z" }

/** The end input of the booking form, with an example UTC timestamp. */
const ENDS_AT: FormInputSpec = { id: "booking-ends-at", name: "endsAt", placeholder: "2026-10-04T10:00:00Z" }

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
            <FormInput
                input={RESOURCE_ID}
                field={props.props.resourceId}
                onChange={props.on.resourceIdChange}
                onBlur={props.on.resourceIdBlur}
            />
            <FormInput
                input={STARTS_AT}
                field={props.props.startsAt}
                onChange={props.on.startsAtChange}
                onBlur={props.on.startsAtBlur}
            />
            <FormInput
                input={ENDS_AT}
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
