# Customer journey reasoning

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.customer-journey` |
| Operators | `customer-journey` |
| Search tags | `journey, user flow, multi-page, direction, approval` |
| Dependencies | `none` |

## Record

Derive the complete user journey before deciding page layouts. A page is a checkpoint in a task, not the unit of product reasoning.

UX is proactive, not merely a reaction to defects. Treat user feedback as evidence of a reusable pain pattern, then search the proposed journey for every state where that pattern could recur before implementation. Do not wait for production failure to discover missing validation, recovery, refresh, resume, async, realtime, or backend-state adaptation.

## Method

Start from the actor's trigger, desired outcome, verified business operations, consequential decisions, and terminal states. Preserve uncertainty as an open fact. Then propose three or four materially different paths; a direction is different only when it changes sequencing, decision timing, recovery, or page boundaries.

Each direction states:

- entry and exit conditions;
- ordered user goals and system commitments;
- page boundaries and why each boundary exists;
- reversible and irreversible actions;
- failure, empty, pending, denied, and recovery paths supported by evidence;
- client validation, business refusal, auth/security, stale or expired, concurrency/idempotency, rate-limit, transport/infrastructure, realtime, refresh and resume edges when applicable;
- journey-wide elements versus page-local elements;
- the main trade-off against the other directions.

Do not produce cosmetic variants of one flow. Do not invent prices, permissions, policies, outcomes, or hidden automation.

Freeze a behavior envelope and failure topology before UI direction. Interaction-container choice belongs to UX. UI may later vary composition, hierarchy, density, and state presentation, but it cannot reorder the journey, move an interaction into another container, change API semantics, or alter business policy without returning to UX/Behavior authority.

## Shared journey ownership

A linear multi-page process gets one journey-progress owner and one reference from each participating page. It is not copied into four page owners. Tabs are reserved for same-page peer panels where only one panel is visible; tabs do not represent progress across routes.

Recommend exactly one direction using evidenced fit, risk, recoverability, and implementation cost. Under `manual`, stop after emitting three or four directions and wait for an exact selected-flow approval receipt. Under `auto-recommended`, bind the recommendation to a selected-flow session receipt and continue without pretending that the other directions were approved. Never persist the batch outside the task session.
