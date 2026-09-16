# Model catalog and allocation

Operation models are declared in `model/<provider>.yaml`, `model/registry.yaml` and `model/runtimes.yaml`. These describe profile/role/model identity, supported operation launch routes, and capacity/suitability respectively. A new model uses the existing allocator and attested launcher; do not add provider-specific scheduling branches or a second provider quota for it.

Headless commands derive model identities from that same target registry and provider profile. Only the
CLI syntax and response parser are provider-family code. A target may declare `headlessModel` when its
headless invocation requires a fixed identity while its native profile deliberately inherits host
configuration; otherwise `requestedModel` and then the declared profile model supply the identity.
An unsupported provider or unresolved model gets no invented command. Registering a headless command
does not bypass eligibility, role, quota or observed model-attestation checks.

Luna (`gpt-5.6-luna`) is an ordinary Codex operation model for implementation, verification and writing. Its working and reviewer profiles remain separate roles. The default capacity is two slots; an owner can explicitly allocate a different bounded count for a workflow. It is eligible for easy/medium operation tiers by default. A requested allocation never supplies missing model qualification, permits prohibited tools, weakens independent review or expands write authority. It is not in the business-decision, planning or ImageGen routes.

Sol, Astra and Luna consume the same observed Codex provider capacity/quota. Their per-model slot counts do not multiply the provider headroom. The global admission ceiling still counts all admitted model jobs and operation workers together. Ten planned agents is distinct from ten concurrent admitted jobs.

The stable `claude-opus` runtime ID names the exact `claude-opus-5` model for both operation profiles and non-operation calls. Effective worker model attestation must match; an unversioned host default is not proof of Opus 5. Existing sealed pins retain their original bytes and require an explicit workflow retry to adopt this version.

## Adding a model

1. Verify its exact launch ID and observed identity with the intended provider/host. Availability is not qualification.
2. Declare working/reviewer profiles only for supported roles and actual tools, then the target launch shape.
3. Declare one provider-family association, roles, bounded capacity and suitable tiers/preferences. Preserve owner config as a separate input to allocation.
4. Add the target only to compatible operation routes. Non-operation planner/manager/validator pools remain separately typed; operation membership does not enroll a model into those pools.
5. Test routing, exact model attestation, shared quota/capacity exclusion, role/tool/quality rejection and owner allocation. Run declaration/build checks before sealing a runtime.

Unknown, unqualified, exhausted or unavailable models produce a typed exclusion. They never silently change to another model while retaining the requested model's label.
