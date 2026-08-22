# Integration

## LOADS

None.

## Record

This pattern governs source architecture after an external provider or infrastructure capability
has been accepted. It places the feature-facing port, provider adapter, translation and lifecycle
registration without allowing a vendor SDK to become domain law.

## Law

An integration has two contracts: the feature contract used by the application and the provider
protocol used by the adapter. The port is stable and capability-shaped; the adapter owns auth,
wire format, retries that are provider-specific and SDK lifecycle. Provider data and failures are
translated at the boundary. Registration is explicit, once, and removable.

The deciding question is: can the feature keep its meaning if the provider, credentials, response
shape or availability changes?

## Situation codes

| Code | Situation | What the source must look like |
|---|---|---|
| `INTEGRATION-1` | A feature needs an external capability | A feature-owned port expresses domain intent and typed result/error contract; feature code imports the port, never the provider SDK |
| `INTEGRATION-2` | An adapter speaks to a provider | One adapter implements the port and contains provider protocol, auth, endpoint and SDK mechanics; credentials arrive through composed configuration |
| `INTEGRATION-3` | Provider data or failure crosses the boundary | Explicit pure translation maps provider fields/statuses/errors to internal DTOs and stable domain/integration failure identities; raw provider objects do not escape |
| `INTEGRATION-4` | The integration enters the runtime | Composition-root registration binds exactly one port implementation, declares lifecycle start/stop and health ownership, and remains replaceable in tests |

## Reading an accepted shape

1. Name the accepted capability and its feature-level outcome; do not begin from the SDK's nouns.
2. Place the port before choosing an adapter, and the adapter before translating provider responses.
3. Register the adapter only after its configuration and lifecycle are explicit.
4. Ask: can a feature test use a fake port (`-1`); is provider auth isolated (`-2`); can a provider
   status change without changing domain code (`-3`); can startup, shutdown and replacement be named
   (`-4`)?
5. Codes compose. A correct port with a raw SDK return still breaks `-3`; a correct adapter that is
   never registered breaks `-4`.

## `INTEGRATION-1` — feature-to-port boundary

The feature defines a narrow port in its application/domain boundary: operations use feature terms,
inputs and outputs are typed, and failures are stable. The port does not expose an SDK client,
provider request, HTTP response or provider credential.

Boundary: not `CQRS`: CQRS decides command/query/event placement; this code decides the capability
edge those operations call. Not `EVENT-DELIVERY`: an external callback may become an event later, but
the provider door is still an integration port.

## `INTEGRATION-2` — adapter provider protocol and auth

The adapter is the only place that imports the provider SDK or constructs its wire request. It receives
typed composed configuration, applies authentication and endpoint policy, and calls the provider.
Feature modules never read provider tokens or environment variables directly.

Boundary: not `CONFIGURATION`: configuration composes and validates values; the adapter uses them to
authenticate. Not `RESILIENCE`: provider call timeouts/retries may be delegated to resilience, while
provider-specific request construction remains here.

## `INTEGRATION-3` — provider data/error translation

The boundary maps provider response fields to an internal result and maps provider status/error shapes
to stable failure identity, retryability and safe metadata. It strips unknown fields and never returns
an SDK object that leaks provider vocabulary into the feature.

Boundary: not `EXCEPTIONS`: exception identity defines the shared failure type; this code decides the
translation from provider failure to that type. Not `OBSERVABILITY`: telemetry may retain a redacted
provider code, but logs do not become the translation API.

## `INTEGRATION-4` — lifecycle registration

The composition root binds one adapter to one port and declares startup, shutdown, health and optional
subscription registration. Registration is explicit and idempotent; tests can provide a fake port
without booting the provider. A provider process is not started merely because an SDK was installed.

Boundary: not `DELIVERY-ASSURANCE`: assurance checks that the declared integration is gated and
secret-safe; this code places it in the runtime. Not `EVENT-DELIVERY`: a provider subscription may
publish a local event, but registration of the provider client remains the integration boundary.

## Layer held

Feature/application layers own ports and internal contracts. Integration adapters own provider SDK,
wire protocol, auth and translation. The composition root owns registration and lifecycle. Configuration
owns validation/composition, resilience owns generic deadline/retry/bulkhead behaviour, event delivery
owns cross-instance fan-out, and observability owns structured telemetry.

## Inputs

| Input | Evidence required |
|---|---|
| capability | Feature operation and stable result/failure contract |
| provider | SDK/protocol, endpoint, auth and provider lifecycle |
| translation | Response/error mapping and redaction policy |
| configuration | Typed values and secret ownership |
| registration | Composition root, startup/shutdown and health owner |
| proof | Fake-port feature tests and provider contract/harness tests |

## Rules

1. Import provider code only inside its adapter.
2. Keep ports capability-shaped and provider-neutral.
3. Translate both success and failure at the boundary.
4. Compose credentials once; never let feature code read raw environment values.
5. Register lifecycle explicitly and exactly once.
6. Keep provider availability from redefining feature semantics.

## Exceptions

- **Provider-native feature.** If the accepted capability is explicitly provider-specific, its port may
  name that capability, but responses and failures still translate and auth stays in the adapter.
- **Webhook/callback.** A transport handler may receive the provider wire shape; it immediately calls
  the adapter translator and must not pass raw data to a feature or event (`INTEGRATION-3`).
- **Shared SDK wrapper.** A platform wrapper may centralize auth or connection pooling, but feature code
  still depends on a port and the wrapper remains behind the adapter (`INTEGRATION-1,-2`).

## Output

```text
capability: <feature capability>
port: <feature port file/type>
adapter: <provider adapter and protocol>
translation: <result and failure mapping>
registration: <composition root/lifecycle owner>
situation: <INTEGRATION-1 | INTEGRATION-2 | INTEGRATION-3 | INTEGRATION-4>
reason: <boundary fact that selects the code>
```
