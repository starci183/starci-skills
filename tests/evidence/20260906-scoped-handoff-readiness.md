# Scoped handoff readiness — 2026-09-06

This evidence records an enforcement correction to the existing requirement-scoped readiness and
read-only source context boundaries. It introduces no product-specific routing rule.

## Independent observations

1. During the StarCiNext documentation handoff, the confirmed mission carried business and
   documentation impacts, runtimeRoles was empty and no flow was named. The existing preflight
   validator correctly skipped the runtime family but required all seven approval classes to become
   walls when the dev environment declaration was absent. The checkout skip loop also rejected
   skipped policy and clean checks solely because a declared route existed. The report consequently
   asked for unrelated environment operations even though the delivery stage authorized a handoff.
   The concrete offending checks were in operators/environment-preflight/validate.mjs: the declared
   checkout skip loop and the invalid-environment approval loop.

2. Independently, downstream workspace selection rejected that read-only route before the business
   operator could read it. scripts/workspace-checkout.mjs required gitPolicy from both route halves
   and assertTree ran even for checkout=routed with declaredWriteRoots empty. This prevented reading
   source context until unrelated user-owned working metadata was cleaned. The owning validator also
   dereferenced gitPolicy unconditionally, although route writeRoots already defined an empty list
   as a read-only binding. Fixing only preflight could not fix this second admission boundary.

## Enforcement and counterevidence

The fixture tests reproduce these boundaries in temporary Git repositories, without modifying the
observed product workspace or ledgers. A confirmed immutable handoff retains declaration and real
Git root/origin/branch/head checks, leaves all readiness rows visible, and records out-of-scope rows
as skipped. A nullable policy binds only a routed read-only receipt with no write roots. Tests verify
that the source working status and reflog are unchanged by observation.

The contrary cases remain required: a runtime role or flow, a product-writing or publication
operator, session selection, a declared write root, an unconfirmed mission or altered frozen scope
cannot obtain the handoff skips. Session selection and actual writes still reject absent policy,
canonical dirt, dirty paths outside the write ceiling, foreign repository identity and forged
receipts. No existing source-writing gate is bypassed and no user-owned metadata is cleaned.

Proof: scripts/handoff-readiness.spec.mjs; scripts/workspace-checkout.spec.mjs;
operators/environment-preflight/self-test.mjs; operators/workspace-bind/self-test.mjs.

## Document execution scope regression

A frozen `implement` mission whose impact is documentation and whose done-when producer is
`business.decide` is lawful under the existing discovery contract. Its planned preflight, routed
read-only binding and business document decision perform no product build, UAT, deployment or runtime
operation. A handoff-stage-only readiness predicate rejected this valid instance unnecessarily.
The same predicate now admits either handoff or implement while retaining the existing handoff
operator vocabulary as the closed ceiling on active operations. Unit and operator tests accept this
case and reject product writing, publication, deployment, browser audits, UAT and runtime operators
at either stage. This is a synthetic regression case, not a claim that those product operations ran.
