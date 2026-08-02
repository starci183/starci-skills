# overlay — in a real system

A surface that covers the page — filed by how it covers, not by what it is about.

The rule is in [`../elements/overlay.md`](../elements/overlay.md). This is one system obeying it,
named so every row can be checked.

Two folders: `modals/` and `drawers/`. That grouping **is** the definition — centred and blocking,
or sliding from an edge.

| Component | Renders | Why this tier |
|---|---|---|
| `ContentModal` | a centred surface over the page | traps focus, dims behind |
| `LessonVideoModal` | a video in a blocking surface | the covering is the job; the video is handed in |
| `PremiumGateModal` · `AiQuotaModal` | a blocking gate the user must answer | blocking is the point — a drawer would be wrong |
| `FoundationModal` · `HeadhunterModal` | a centred detail surface | same shell, different content |
| `ContentAiChatDrawer` | a side panel that keeps the page visible | the page stays readable — that is why it is a drawer |
| `SubmissionAttemptsDrawer` · `E2eResultDrawer` | history alongside the thing it belongs to | comparison needs both visible at once |
| `PersonalProjectTaskAttemptsDrawer` | attempts beside the task | same reason |

## The test

> Does it trap focus and dim what is behind?

If neither, it is not covering anything, and a composite in a card would have done the job with far
less machinery.

## Where it erodes quietly

An overlay owns the **surface**: scrim, focus trap, escape handling, entry animation. It should not
own the entity being shown — that belongs to a block placed inside it.

The signal that it has drifted is a modal with a domain-shaped prop list. At that point the shell
has stopped being reusable and one feature owns it.

---

Read from a live tree with `scripts/audit/scan-storybook-architecture.mjs`. Another repo answers with
different names, and its answer outranks this file.
