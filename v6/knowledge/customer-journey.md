# Customer journey reasoning

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.customer-journey` |
| Operations | `customer-journey` |
| Search tags | `journey, user flow, multi-page, direction, approval` |
| Dependencies | `none` |

## Record

Derive the complete user journey before deciding page layouts. A page is a checkpoint in a task, not the unit of product reasoning.

## Method

Start from the actor's trigger, desired outcome, verified business operations, consequential decisions, and terminal states. Preserve uncertainty as an open fact. Then propose two or three materially different paths; a direction is different only when it changes sequencing, decision timing, recovery, or page boundaries.

Each direction states:

- entry and exit conditions;
- ordered user goals and system commitments;
- page boundaries and why each boundary exists;
- reversible and irreversible actions;
- failure, empty, pending, denied, and recovery paths supported by evidence;
- journey-wide elements versus page-local elements;
- the main trade-off against the other directions.

Do not produce cosmetic variants of one flow. Do not invent prices, permissions, policies, outcomes, or hidden automation.

## Shared journey ownership

A linear multi-page process gets one journey-progress owner and one reference from each participating page. It is not copied into four page owners. Tabs are reserved for same-page peer panels where only one panel is visible; tabs do not represent progress across routes.

Stop after emitting two or three directions. Continue only from an explicit selected-flow approval receipt.
