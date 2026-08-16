---
id: fe-senses-call-to-action-changelog
title: changelog.md
slug: /fe/senses/call-to-action/changelog
sidebar_label: changelog.md
sidebar_position: 5
description: Version history for the Call-to-action canon module.
---

# changelog.md

> Current version: `1.03` · Module: `call-to-action` · Audit: [`audit.md`](./audit.md)

This record is append-only and tracks accepted CTA canon changes.

## Version Policy

- One version belongs to all six records.
- Accepted changes increment `0.01`.
- Audit findings alone do not change canon.

## 1.03 — 2026-08-16

### Added

- Adopted `design-canon-v1` common section order.
- Added `prompt.md` with 18 business-only tests: 15 unique action trees and 3 safe stops.
- Added closed output mapping for role, component, variant, size and state.

### Changed

- Defined secondary as subordinate and outline as an alternative instead of main.
- Closed physical sizes to `sm` embedded/persistent and `md` standalone.
- Replaced unsupported `danger` guidance with real `ConfirmButton` behavior.
- Reordered guide, examples and audit to the shared template.

### Audit decisions

- Accepted CTA-A01 through CTA-A04 corrections.
- Kept sticky-mobile and compact-copy questions as scoped follow-up findings.

### Verification

- Version parity across six records.
- Template section-order validator.
- Business prompt self-review against current Button, TextLink, EmptyNotice and ConfirmButton source.

## 1.02 — 2026-08-16

- Added ten interactive HeroUI UI/Code demos for completion, state, recovery and destructive cases.
- Integrated interaction registry and production build.

## 1.01 — 2026-08-16

- Converted the flat law into the five-record module.
- Resolved one-primary-ask versus path-onward contradiction.

