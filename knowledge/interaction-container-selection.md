# Interaction container selection

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.interaction-container-selection` |
| Operators | `interaction-container-decision` |
| Search tags | `page, modal, dialog, drawer, sheet, popover, inline, responsive transformation, focus return` |
| Dependencies | `fe.customer-journey, fe.state-modeling` |

Choose the container from the job the interaction performs, not from visual novelty or implementation convenience. Every meaningful interaction must consider `page`, `modal`, `drawer`, `popover`, and `inline`; the artifact records why four were rejected.

## Page

Use a page for the primary journey, a durable destination, a resumable or deep-linked task, multi-step work, or content that needs substantial space. A page owns navigation and history. Do not hide a journey inside an overlay merely to keep the previous screen visible.

## Modal

Use a modal for a short, bounded decision that intentionally interrupts the current task and must be completed or cancelled before continuing: destructive confirmation, submission confirmation, or one compact choice. Reject a modal for primary journeys, long or scroll-heavy content, comparison with the background, resumable work, or multi-step forms.

## Drawer

Use a drawer for contextual secondary work that benefits from keeping the current page visible: inspection, preview, history, filters, supporting configuration, or a question navigator. A drawer preserves page context and must not impersonate a durable destination. On constrained viewports it normally becomes a sheet or full-screen contextual surface with an explicit return path.

## Popover

Use a popover for a lightweight anchored disclosure or immediate micro-choice. It owns no durable workflow, long content, multi-step state, or critical recovery path. Viewport collision may change placement; mobile may transform it into a bottom sheet or inline disclosure.

## Inline

Use inline presentation when the content belongs permanently to a stable region and must remain visible while the user works there: validation, local status, or a small control group. The owning surface must be explicit. Do not use inline placement when a focused interruption or contextual workspace is required.

## Decision tests

Before selecting a container, answer:

1. Is this the primary task, URL-owned, resumable, or multi-step? Prefer page.
2. Must the background be blocked until one bounded decision completes or cancels? Prefer modal.
3. Must the user retain and compare page context while doing secondary work? Prefer drawer.
4. Is it an anchored disclosure or immediate micro-choice? Prefer popover.
5. Does it have a stable surface owner and belong continuously in that region? Prefer inline.

Declare trigger, close/back behavior, dismissal rules, focus entry and return, background interaction, scroll ownership, and responsive transformation. Reject nested overlays, container choice by available component alone, and desktop behavior copied unchanged to mobile without evaluation.
