# Services of one product

A product that runs more than one back-end service stays one repository, one `package.json` and one lockfile. This page is the
policy the `hfs check` rules R137 to R142 enforce and the way the reference example, `examples/ecommerce-app`, follows it.

## One place for a service

Every back-end service is a Nest app at `be/apps/<service>/` (`main.ts`, `app.module.ts`, its options, its `Dockerfile`). The apps
share the libraries under `be/src` (`features/`, `modules/{domain,integrations,platform}/`) and nothing else:

- a folder with a `Dockerfile` or a `package.json` of its own outside `be/apps/<service>/` is a second service root and a finding
  (`HFS_SERVICE_PLACEMENT`, R137);
- a file of one service app never imports a file of another service app (`BE_SERVICE_ISOLATION`, R142, ESLint
  `starci-be/service-isolation`): shared code moves to `be/src`, and services meet over the wire;
- every one-off action (migrate, seed, sync, backup, operator commands) is a command of the one `be/apps/cli` app, never an
  argument or script of a service.

## Images

`.starcistacks/application-stacks.yaml` declares every service as a component with `role: service` (`HFS_SERVICE_STACK_DECLARATION`,
R139). Every `image` of a product with more than one service is pinned (`HFS_IMAGE_UNPINNED`, R138): a digest
(`name@sha256:...`) or an exact version (`x.y.z`), never a missing tag, `latest`, a branch word or a major-only tag.

- An own service image is `<repo>/<service>:<x.y.z>` and is built from `be/apps/<service>/Dockerfile` with the app root as the
  build context. The compose service names the image and its `build` block; the version in the tag is the version of the image.
- A service the product does not own (a database, an identity server, an object store) stays a third-party image in the same
  stack, pinned the same way. The test world reads every image from the stack definition, so a version is decided once.

## The contract between services

A synchronous API keeps its snapshot under `be/contracts/<service>/` (`schema.graphql`, `openapi.json`), emitted by `npm run
contract:emit` and judged for drift (R23) and by its consumers (R113). The messages a service publishes follow the same pattern:

```ts
// be/apps/order/src/events.ts - the literal table of the events the order service publishes
export const EVENTS = {
    "order.placed": { version: 1, payload: { orderId: "string", personId: "string", totalMinorUnits: "number" } },
} as const
```

`hfs emit-contracts` writes `be/contracts/order/events.json` (`starci/event-contract@1`) from it. A consumer states what it reads
in `be/apps/<app>/src/consumes.ts`:

```ts
export const CONSUMES = { order: { "order.placed": 1 } } as const
```

`HFS_EVENT_CONTRACT` (R140) refuses a snapshot that no longer equals the provider's table, a consumed event the provider's
snapshot does not declare, a version mismatch, an event that `compensates` an event no contract declares, and a queue a consumer
defines with `defineQueue` that no consumes table lists. A breaking change bumps the `version`; every consumer that has not
followed fails the check.

## Messages, idempotency, retries

Asynchronous messages travel on the queues of `platform/messaging` (BullMQ over the Redis of the stack); the queue of an event is
its name. A publisher appends after its commit (an order is never failed by a queue that is down; a replayed confirmation
announces again, which repairs a lost announcement). A consumer is a `transport/message/<event>.consumer.ts` of a worker app that
dispatches one command; the receiver dedupes on the event id, either with the inbox claim (R80) or because the effect is
idempotent by state (cancelling an order that is already cancelled changes nothing). A delivery that fails is delivered again
after an exponential backoff; a message that runs out of attempts stays in the dead letters of its queue, where an operator
command reads it.

## Sagas and compensation

A saga is a chain of services reacting to each other's events; the canon has no in-process event (R87). A product declares the
pattern (`"patterns": ["saga"]` in `hfs.json` `sides.be`), which enables the saga slots; a saga folder in a product that has not
declared it is `HFS_SLOT_NOT_ENABLED`. The saga is a folder of a feature (`knowledge/patterns/be/saga.yaml` lists every path with its slot):

```text
be/src/features/<feature>/saga/
  <saga>.saga.service.ts          the orchestrator: lists the steps and compensations, a service unit-tested beside it
  <saga>.saga-state.ts            the typed state of a run: status and the version fence
  steps/<step>.step.ts            one step: names its event, dispatches one command
  compensations/<step>.compensation.ts   REQUIRED for every step: names the failure event, dispatches one command
```

The consumers (`transport/message/<event>.consumer.ts`) hand the delivery id to a command, and the saga takes every event through
the inbox. The state machine, the version fence and the inbox of a run are `platform/saga`: a run is started in the transaction of
the first step (`begin`), moved to `compensating` at the version it read when the failure event arrives, settled as `compensated`
once the compensation ran (a failing compensation gives the event back, so the redelivery resumes the run), or settled as
`completed` when the last step is confirmed. The failure of a step is an event whose contract declares `compensates: "<event of
the step it undoes>"`. Five checks keep it honest: `BE_SAGA_STEP_COMPENSATION` (R143), `BE_SAGA_STATE_VERSIONED` (R144),
`BE_SAGA_EVENT_CONTRACT` (R145), `BE_SAGA_CONSUMER_DEDUPE` (R146) and `BE_SAGA_E2E_MISSING` (R147: every compensation path has an e2e
spec that names its event and injects a failure through the world). In the example, `order.placed` starts the billing service's
invoice; when the invoice is above the limit `billing.invoice-rejected` (which compensates `order.placed`) makes the order service
cancel the order and release its stock, and `billing.invoice-issued` completes the run. The e2e spec
`order/invoice-rejected` also cuts the order database while the rejection is delivered and proves the compensation resumes on the retry.

## Specs

Every consumed event is named by an e2e spec, a file `be/src/tests/e2e/<area>/*.e2e-spec.ts` that boots the real apps through
`useTestWorld`, publishes the event, reads the persisted effect back and redelivers it (`BE_ASYNC_SPEC_MISSING`, R141). The spec of a
saga step also names the compensated event, so it drives the whole flow: the step, the failure, then the compensated state.
Sibling services run as real apps in the world, never as fakes; a third-party SaaS stays a fake at the network edge.

## The reference example

`examples/ecommerce-app` runs four back-end apps: `identity` and `order` (GraphQL, calling each other), `billing` (consumes
`order.placed`, records an invoice, announces a rejection) and `migrate`; the order service also consumes `billing.invoice-rejected`, the compensating
step of its saga. Its e2e specs `billing/order-placed` and `order/invoice-rejected` prove the asynchronous path, the redelivery and
the compensation on the real stack; `integration/messaging` proves the queue adapter against Redis.
