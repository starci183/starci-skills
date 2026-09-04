# identity.provision

## Job

Provision the identity one flow signs in as: create each alias's account at the identity provider
the bound route's registry entry declares, set its password from the sealed credential resolved by
name, prove the account signs in, and publish the record of names the flow folder keeps; or rotate
the administrator custody the same provider stands on.

## Done when

Done when the flow's account exists at the declared provider and signs in with the sealed credential
resolved by name, the `checks` prove the identity proof set with none absent or failed, the
`uat-account` carries only names and is written into the flow folder beside the drafted flow
document, and the `delta` records each account created against the route's entry; or, under mode
rotation, bound by `identityRotation`, the `delta` proves the new credential works and the old one
fails, and no account record is published.

## A missing record is created, not reported

Provisioning is the default branch, not the exception. A flow with no folder, no flow document and no
account is a flow nobody has run yet, and this operator creates all three: the flow document is
drafted from the shipped template and marked as a draft in the receipt, and the account is created
at the provider the registry entry declares, its password set from the sealed shared credential
resolved by name. Reporting any of that as an error is wrong, and stopping at "a person must create
an account" is the same error with a politer sentence. Two things are genuinely not this operator's
to invent, and they are the only stops on this path: a registry entry that declares no identity at
all is `INVALID_INPUT` naming the field it lacks, and a provider or sealed file that cannot be
reached is `PROVISIONING_UNAVAILABLE`. The seed is not this operator's either: it is placed by the
operator that owns data, against the account this one created.

## A credential is a name, and it reaches a form or a body

Before resolving a value, apply [the identity preflight](../../resources/identity.md) for the selected
operation through its fixed consuming helper.

One password is sealed per environment and every flow's account is set from it, while each flow owns
its own username. It is resolved by name at the moment of the call, and the only two places its value
may arrive are the request body of the provider's administrative call and the field of a sign-up form
in a driven browser. It never enters a file, a fixture, a recorded command, a capture or a receipt.
The account record this operator publishes therefore carries a username, a role, a credential name,
the sealed file's path and the registry entry it belongs to, and has nowhere to put a secret even by
accident.

A diagnostic is not a third place. A command run only to prove that a sealed value resolves reports
the outcome of resolution — that it resolved, the name it resolved by, and a length or a digest when
something more is needed to tell one resolution from another — and never the value. The value still
moves only from its store to the form or the body that consumes it, with nothing in between that
would render it: no intermediate the command echoes, prints or returns for a person or a transcript to
read. A diagnostic that cannot be written that way, because the only proof it knows how to give is the
value itself, is not run; the operator reports what it could not check rather than checking it
unsafely.

## Credentials are resolved, never recorded

A capability is a handle and its custody evidence. The credential behind it is resolved for use at
the moment of the call and is never logged, echoed into evidence, or persisted. The receipt refuses
the handle as well as the value, because a receipt is durable and a durable record of a capability is
a leaked credential with a delay; a string carrying credential material anywhere in the request or
the response is refused as malformed.

## Administrator rotation is bound, staged and proved

Administrator rotation uses the existing identity capability and requires an explicit approval id.
The actual provider custody is proved from its credential mounts or captured bootstrap environment
before consuming a value. The `identityRotation` binding names the exact provider, realm, credential
name, principal fingerprint and protected custody write set; `stagingRefs` separately authorizes
protected ciphertext staging. It runs alone, creates no UAT account and needs no flow. The delta
repeats that binding and proves the new credential works, the old credential fails, the exact
administrator sessions were invalidated and every declared custody projection agrees. The complete
identity check set still applies. Stage ciphertext only, journal each provider and file effect
separately, and retain encrypted recovery material until consistency is proved; a provider and
several files are not one atomic transaction. Every consuming helper validates the frozen request and
platform authority internally before effects.

## The desired state is one approved declaration

`desiredState` is the whole of what the caller asks for: the approved plan hash, the service kind
(always `identity` here), the entry to act on, the effects to apply — `provision-identity`, or
`rotate-admin-credential` alone — and the two scope sets that say which resources may change and
which may only be observed. `approval` covers that declaration, hash and all, so a field edited
afterwards no longer matches the hash the approval named. Where the authority behind `approval`
comes from is the environment's to say, per operation class, in the shape the environment schema
(`readiness/initialization/stacks/environment.schema.json`) gives: `approval` accepts an approval id
or the declaration's reference — its path and content hash — when the declaration marks
identity provisioning `declared` for `env`, and a hash that moved between the request and the run is
`AUTHORITY_DRIFT`. Rotation belongs to no declared class and always takes an approval id. `approval`
has no default: an identity other flows share is never changed on silence.

## Boundary

Context is read-only apart from the approved delta. The operator creates accounts at the provider the
registry entry declares, writes the flow folder of the flow it provisions for — the account record
and the drafted flow document — and writes only `response/` of its own branch: `data/delta.json`,
`data/checks.json`, `data/account.json`, `response.md` and `response.json`. Under `identityRotation`
it also stages ciphertext into the exact custody and staging refs the binding names. It does not seed
data, serve a runtime, start or stop a process, or write the runtime entry; does not record a
credential value, capability handle, or secret-shaped token anywhere in the output, in the account
record, or in the flow folder; does not ask a person to sign in, to create an account, or to paste a
credential; does not edit knowledge, write an environment's declaration, or otherwise grant its own
approval; and does not claim a provisioned outcome while any required check is absent or failed.

## Context

| Alias | Bind | Required |
| --- | --- | --- |
| `@worktrees/sessions/central-runtime` | the entry of the bound route: the identity provider and realm it declares, read by fingerprint and generation | yes |
| `@workspaces/device-state` | the sealed credential by name and its custody; values never appear | yes |
| `@worktrees/uat/<flow>` | the flow folder this operator writes: the account record and the drafted flow document | no |
| `@worktrees/_templates` | the flow template a missing flow document is drafted from, consumed and never modified | no |

## Inputs

| Kind | From | Required |
| --- | --- | --- |
| `environment-readiness` | `environment.preflight`; the custody and provider checks already answered once, read as evidence and never as approval | no |

## Requirements

| Field | Type | Default | Ask |
| --- | --- | --- | --- |
| `routeKey` | id | — | The `<project>/<role>` registry entry whose declared identity provider the accounts are created at |
| `flow` | id | null | The flow whose dedicated identity is provisioned and whose folder receives the account record and the drafted document; required unless `identityRotation` is bound |
| `env` | id | dev | The stack the provisioned accounts belong to; an account of one stack is not an account in another |
| `approval` | id | — | The authority that covers this desired state: an approval id, or the environment declaration's reference — its path and content hash — when that declaration marks identity provisioning `declared` for `env`; no default, because silence is not consent |
| `desiredState` | `{planSha256, serviceKind, resourceRefs, effects, mutableResourceRefs, observationOnlyResourceRefs}` | — | The approved declaration: which plan, the `identity` kind, the entry it acts on, the effects — provisioning, or rotation alone — and what may change against what may only be observed |
| `identityRotation` | `{provider, realm, credentialName, principalFingerprint, custodyRefs, stagingRefs}` | null | Required only for administrator rotation; exact bound principal and protected write set |
| `resume` | token | null | The blocked branch's token when re-entering after a stop |

## Steps

| # | Step | Params | Reads | Writes | Stops with |
| --- | --- | --- | --- | --- | --- |
| 1 | Validate the gate and the resume against the frozen generation | `resume` | `request/request.json`, @worktrees/sessions/central-runtime at the frozen generation | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Bind the authority — an approval id, or the environment's declaration re-read and re-hashed — and run the identity preflight `scripts/identity-custody.mjs` through @tools/shell, proving the custody by name and never by value | `approval`, `env` | @workspaces/device-state for the sealed credential's name and custody, the environment's declaration when `approval` references it, @tools/secrets | — | `AUTHORITY_DRIFT`, `PROVISIONING_UNAVAILABLE` |
| 3 | Read the entry's identity declaration and the flow folder, and draft the flow document from the template when it is absent | `routeKey`, `flow` | @worktrees/sessions/central-runtime for the provider and realm the entry declares, @worktrees/uat/<flow> for the existing record and document, @worktrees/_templates for the flow template | @worktrees/uat/<flow>, @tools/sourcewrite | `INVALID_INPUT` |
| 4 | Create each alias's account at the provider with the sealed credential resolved by name into the request body, or rotate the administrator custody under the bound principal and stage its ciphertext | `desiredState`, `identityRotation` | @worktrees/uat/<flow> for the aliases the flow document names, @workspaces/device-state for the credential by name, @tools/secrets, @tools/http | `response/data/delta.json` | `PROVISIONING_UNAVAILABLE` |
| 5 | Prove the identity proof set: the provider reachable, the credential resolvable, each account existing and signing in through @tools/browsercontrol or the token endpoint, and no credential recorded anywhere written | — | @worktrees/sessions/central-runtime for the provider, @tools/http, @tools/browsercontrol | `response/data/checks.json` | `IDENTITY_UNPROVEN` |
| 6 | Write the account record of names into the flow folder and publish it | `flow`, `env` | `response/data/delta.json` for the accounts created | @worktrees/uat/<flow>, `response/data/account.json` | — |
| 7 | Write the receipt and emit | — | everything above | `response/response.md`, `response/response.json` | — |

A resume begins again at validation, reuses only unchanged fingerprinted observations, and consumes
the exact delta; a resume that adds no authority, provider or desired-state change is `NO_PROGRESS`.

## Outputs

| Kind | File | Type | Required |
| --- | --- | --- | --- |
| `platform-operation-receipt` | `response/response.md` | md | yes |
| `delta` | `response/data/delta.json` | data | yes |
| `checks` | `response/data/checks.json` | data | yes |
| `uat-account` | `response/data/account.json` | data | no |

## Stops

| Code | Disposition |
| --- | --- |
| `INVALID_INPUT` | terminate |
| `SOURCE_DRIFT` | terminate |
| `NO_PROGRESS` | terminate |
| `AUTHORITY_DRIFT` | terminate |
| `PROVISIONING_UNAVAILABLE` | terminate |
| `IDENTITY_UNPROVEN` | terminate |

## Next

| When | Operator |
| --- | --- |
| the routed checkout or its head no longer matches the frozen binding | `workspace.bind` |
| the flow's identity is provisioned and its seed must be placed against that account | `data.seed` |
| the flow's identity is provisioned and the surface that required it may be observed | `interface.audit` |
| the flow's identity is provisioned and the run that waited on it may verify the flow | `uat.verify` |
