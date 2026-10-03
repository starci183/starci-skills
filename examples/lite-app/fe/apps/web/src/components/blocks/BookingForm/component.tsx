import { Button, Form, Input, SectionHeader, Text } from "@starci/grammar/common"

/** Copy, state and actions for the resource and booking forms. */
export interface BookingFormBaseProps {
    readonly props: {
        readonly title: string
        readonly resourceLabel: string
        readonly bookingLabel: string
        readonly bookingResourceLabel: string
        readonly startsAtLabel: string
        readonly endsAtLabel: string
        readonly addResourceLabel: string
        readonly addBookingLabel: string
        readonly resourcePending: boolean
        readonly bookingPending: boolean
        readonly resourceMessage?: string
        readonly bookingMessage?: string
    }
    readonly on: {
        readonly resource: (input: FormData) => void
        readonly booking: (input: FormData) => void
    }
}

/** Draws the authenticated booking workspace without reading copy or database state. */
export const BookingFormBase = (props: BookingFormBaseProps) => (
    <>
        <SectionHeader title={props.props.title} level={2} />
        <Form label={props.props.resourceLabel} isPending={props.props.resourcePending} onSubmit={props.on.resource}>
            <Input id="resource-id" name="resourceId" label={props.props.resourceLabel} isRequired />
            {props.props.resourceMessage === undefined ? null : (
                <Text live="polite">{props.props.resourceMessage}</Text>
            )}
            <Button type="submit" variant="primary" isPending={props.props.resourcePending}>
                {props.props.addResourceLabel}
            </Button>
        </Form>
        <Form label={props.props.bookingLabel} isPending={props.props.bookingPending} onSubmit={props.on.booking}>
            <Input id="booking-id" name="bookingId" label={props.props.bookingLabel} isRequired />
            <Input
                id="booking-resource-id"
                name="bookingResourceId"
                label={props.props.bookingResourceLabel}
                isRequired
            />
            <Input
                id="booking-starts-at"
                name="startsAt"
                label={props.props.startsAtLabel}
                placeholder="2026-10-04T09:00:00Z"
                isRequired
            />
            <Input
                id="booking-ends-at"
                name="endsAt"
                label={props.props.endsAtLabel}
                placeholder="2026-10-04T10:00:00Z"
                isRequired
            />
            {props.props.bookingMessage === undefined ? null : <Text live="polite">{props.props.bookingMessage}</Text>}
            <Button type="submit" variant="primary" isPending={props.props.bookingPending}>
                {props.props.addBookingLabel}
            </Button>
        </Form>
    </>
)
