# Integration

## LOADS

None.

## Record

Bind an accepted external capability to a feature port, one provider adapter, explicit translation and
composition-root lifecycle. Keep provider vocabulary and credentials outside feature code.

## Law

The port is feature-shaped; the adapter owns SDK/protocol/auth; translation converts provider success
and failure into internal contracts; registration binds one implementation and its lifecycle. Provider
availability never becomes domain semantics by accident.

## Situation codes

| Code | Situation | Binding source shape |
|---|---|---|
| `INTEGRATION-1` | Feature-to-provider boundary exists | Feature-owned typed port, no SDK/request/credential types |
| `INTEGRATION-2` | Provider protocol is called | Adapter-only SDK import, composed typed config, isolated auth/endpoint |
| `INTEGRATION-3` | Provider data/error crosses boundary | Explicit response/error translator, stable internal DTO/failure and safe metadata |
| `INTEGRATION-4` | Provider enters runtime | One composition-root binding with declared start/stop/health and test replacement |

## Reading an accepted shape

Resolve port, adapter, translation and registration in that order. Emit all matching codes. A correct
port with raw SDK output is still `INTEGRATION-3`; an unregistered adapter is `INTEGRATION-4`.

## `INTEGRATION-1` — feature-to-port boundary

Keep the feature-owned port typed and capability-shaped, with no SDK, wire or credential types.

## `INTEGRATION-2` — adapter provider protocol and auth

Keep provider SDK, protocol, endpoint and auth inside one adapter using composed typed configuration.

## `INTEGRATION-3` — provider data/error translation

Translate provider success and failure to stable internal DTOs and failure identities before return.

## `INTEGRATION-4` — lifecycle registration

Bind one implementation in the composition root and declare startup, shutdown, health and test replacement.

## Boundaries

- `CQRS` owns command/query/event feature semantics; integration owns the external capability edge.
- `EVENT-DELIVERY` distributes decided facts; a provider callback does not bypass translation.
- `OBSERVABILITY` owns structured telemetry, not provider-to-domain mapping.
- `DELIVERY-ASSURANCE` owns gates, secret safety and proof fences, not runtime registration.
- `CONFIGURATION` validates/composes values; `RESILIENCE` supplies generic call budgets. The adapter
  remains the owner of provider protocol details.

## Layer held

Ports live with feature/application code; SDK, auth and translation live in adapter modules; lifecycle
lives in the composition root. All four codes are documented unless a named backend machine enforces
one narrowly.

## Inputs

| Input | Evidence |
|---|---|
| feature contract | Capability, typed result and stable failure |
| provider contract | Protocol, auth, endpoint and lifecycle |
| translation | Success/error mapping and redaction |
| runtime | Binding, health, start/stop and fake replacement |
| proof | Feature fake tests and provider contract tests |

## Rules

1. Keep SDK imports inside adapters.
2. Keep ports provider-neutral.
3. Translate success and failure before returning.
4. Compose secrets once and register lifecycle explicitly.
5. Do not let provider availability redefine domain meaning.

## Exceptions

Provider-specific capability names are allowed only when accepted explicitly. Webhooks must translate
immediately. Shared wrappers may own pooling/auth but remain behind the feature port.

## Output

```text
capability: <feature capability>
port: <file/type>
adapter: <provider adapter>
situation: <INTEGRATION-1 | INTEGRATION-2 | INTEGRATION-3 | INTEGRATION-4>
reason: <boundary fact>
```
