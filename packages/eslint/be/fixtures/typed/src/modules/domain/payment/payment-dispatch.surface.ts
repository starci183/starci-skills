/** Fixture: a barrel never conceals a bus or a feature command handler's true declaration. */
export { CommandBus as DispatchBus, QueryBus as LookupBus, EventBus as LocalEvents } from "@nestjs/cqrs"
export { StartCheckoutHandler as PaymentCommandHandler } from "@features/api/checkout/application/start-checkout.handler"
