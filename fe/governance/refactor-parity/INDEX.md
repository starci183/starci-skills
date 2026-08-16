---
id: fe-governance-refactor-parity-index
title: INDEX.md
slug: /fe/governance/refactor-parity
sidebar_label: refactor-parity
sidebar_position: 0
description: Machine-oriented rules for preserving observable UI during refactors.
---

# INDEX.md

Version: `1.02`

Vietnamese guide: [vi.md](vi.md) · Human examples: [example.md](example.md)  
Governance: [audit.md](audit.md) · Version history: `changelog.md`

## Objective

Change ownership or architecture without changing what a reader, keyboard user, screenshot test, or
accessibility tree observes. Any observable difference is redesign scope, not refactor scope.

## Load Policy

1. Apply this file before moving or rewriting UI.
2. Read `vi.md` for the evidence and verification workflow.
3. Read `example.md` for concrete/UI comparisons.
4. Do not load `audit.md` or `changelog.md` during ordinary implementation.

## Required Evidence

Record before editing:

```text
reference component and assets: <paths>
states: signed-out | signed-in | loading | empty | populated | error
themes: light | dark
viewports: narrow | wide
semantics: roles | names | states | focus order | keyboard actions
geometry: grouping | layers | overflow | spacing | size | border/shadow | radius
content: copy | counts | stable option domains
```

## Invariants

- Inspect the real reference, asset, and computed style; do not reconstruct from memory.
- Preserve semantic primitives, focus behavior, roles, names, and state.
- Preserve compound landmarks as one landmark.
- Copy exact assets and tokens; a nearby value is a redesign decision.
- Verify the complete state/theme/viewport matrix.
- Architecture translation grants no visual or product invention.
- Selection changes semantic state, not peer geometry.
- Stable option lists come from the domain anchor, not the current selection.
- Preserve the reference overflow interaction; do not substitute browser-native geometry silently.

## Decision Procedure

1. Capture reference evidence and matrix.
2. Copy observable behavior/render before translating ownership.
3. Map each reference responsibility into the new architecture without changing its output.
4. Compare semantics, geometry, content, state, theme, and viewport.
5. If a difference is intentional, split it into an explicit redesign change.

## Review Output

```text
reference: <path/version>
observable delta: none | <list>
semantic parity: pass | fail
visual parity: pass | fail
state matrix: pass | missing <states>
theme matrix: pass | missing <themes>
viewport matrix: pass | missing <viewports>
redesigns separated: yes | no
```

## Version Rule

Increment accepted module changes by `0.01`; update every module record. Audit remains advisory.
