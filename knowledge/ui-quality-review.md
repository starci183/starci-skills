# Frontend UI quality review

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.ui-quality-review` |
| Contract revision | `7.6.0` |
| Operators | `test/ui-quality-audit` |
| Search tags | `ui quality, accessibility, interaction, responsive, visual stability, forms, motion, browser audit` |
| Dependencies | `workspace.routing, fe.audit-loop-v75b` |

## Authority boundary

This record owns product-neutral, browser-observable UI quality rules. It does not choose product style, business meaning, page ownership, layout direction, Grammar, or implementation stack. The operator applies only rules whose declared applicability matches the audited platform and surface. A rule that cannot be observed from the frozen browser target is `blocked`, never guessed from source.

Each result names one stable rule ID, applicability, severity, observable evidence, and negative boundary. `not-applicable` requires a recorded reason. A pass requires positive evidence; absence of a detected failure is not proof.

## Rule registry

| Rule ID | Applicability | Required observable | Severity | Negative boundary |
| --- | --- | --- | --- | --- |
| `uiq.a11y.name-role-state` | Interactive web or app control | Control exposes an accessible name, correct role, and applicable state; decorative visuals do not add duplicate semantics. | error | Do not prescribe a component library or glyph. |
| `uiq.a11y.keyboard-focus` | Keyboard-capable surface | Every operation is keyboard reachable; focus order is predictable, visible, returned after overlays, and not obscured by authored sticky content. | error | Do not redesign navigation hierarchy. |
| `uiq.a11y.non-color-signal` | Meaningful status, validation, selection, or chart | Meaning remains understandable without color alone and text/non-text contrast is measured against the actual composed background. | error | Do not choose brand colors. |
| `uiq.a11y.zoom-text-reflow` | Responsive web or scalable-text app | Increased text size and compact width preserve content, controls, reading order, and operation without two-dimensional page scrolling. | error | Do not choose typography personality. |
| `uiq.interaction.target-spacing` | Pointer or touch target | Target size or spacing meets the declared platform baseline and adjacent actions can be selected without precision traps. | error | Do not reuse native units as CSS pixels or invent one cross-platform number. |
| `uiq.interaction.scope-state-parity` | Interactive or adjacent static surface | Each action declares one observable hit-target scope: inline action changes only its named text/CTA, whole-surface action changes the complete hit target, and static surface has no hover treatment. Hover has keyboard-focus parity; active/pressed is transient; selected, expanded, pending and disabled remain persistent and distinguishable where applicable; reduced motion preserves non-motion feedback. | error | Do not infer scope from title presence, prescribe product color tokens, or turn a static container into an action. |
| `uiq.interaction.feedback-state` | Action with pending, success, error, disabled, or destructive state | Activation produces prompt feedback; pending prevents accidental duplicate action; errors identify recovery; disabled/read-only/destructive states remain distinct. | error | Do not infer business success or entitlement. |
| `uiq.motion.preference-stability` | Animated or auto-moving surface | Motion has a functional purpose, respects the platform reduction preference, preserves comprehensible state, and does not shift surrounding layout during control feedback. | warning | Do not prescribe an animation library or a universal duration. |
| `uiq.layout.viewport-reflow` | Declared compact, intermediate, and wide viewports | Core content and actions remain reachable with no unintended horizontal page overflow; persistent fixed layout regions reserve their owned boundary, while a declared draggable overlay follows its no-spacer constraint/release lifecycle. | error | Do not choose layout direction or ownership. |
| `uiq.layout.visual-stability` | Web page with asynchronous media or content | Expected async regions reserve geometry and measured unexpected layout shift stays within the declared project threshold. | warning | Do not treat every intentional user-triggered movement as failure. |
| `uiq.forms.label-error-recovery` | Form or editable field | Persistent label and instructions are associated; invalid submission exposes field-level recovery and moves or announces focus according to the declared error-summary policy. | error | Do not invent validation or business rules. |
| `uiq.navigation.orientation-return` | Multi-route, overlay, or multi-step flow | Current location and exit are discoverable; back/close returns predictably; route change and overlay dismissal place focus at the declared destination. | error | Do not add or remove product destinations. |
| `uiq.data.alternative-format` | Chart or dense data visualization | Values have accessible text or table equivalence, units and legends are readable, interaction is not hover-only, and meaning is not encoded by color alone. | warning | Do not choose the business metric or chart type unless already declared. |

## Evidence contract

Audit the exact declared state at every declared viewport. Evidence may include accessibility-tree snapshots, keyboard traversal records, computed contrast, element rectangles, overflow measurements, reduced-motion observations, layout-shift entries, screenshots, and sanitized traces. The receipt records the browser build, route, surface/state IDs, viewport, source revision, knowledge generation, command/config fingerprint, and applied rule IDs.

For `uiq.interaction.scope-state-parity`, baseline-only evidence is invalid. Record resting, pointer
hover, keyboard `focus-visible`, and pressed/active observations for every representative interaction
family; additionally record selected, expanded, pending and disabled states where reachable. Observe
the complete hit target and its adjacent static surface so a child-only effect or leaked card effect
cannot pass. When motion exists, repeat the representative transition with reduced motion enabled.

The registry returns typed observations only. It never creates a quality stage, performs repair, or
routes the mission. Classification is `frontend-local` only when correction preserves the compiled
layout, ownership, responsive transformation, business behavior, and source boundary; otherwise
return exact boundary/cross-domain evidence to the canonical frontend machine.

## Provenance

The rule set is a StarCi synthesis, not a copy of another skill or dataset. An audit of local `ui-ux-pro-max` (`SKILL.md` SHA-256 `ea087c341bfb5b23195c7302027268ede86da802554c18a5c4896a6017b439f9`; `quick-reference.md` SHA-256 `0609bc7c89dacb40472465d8fc14257b56b2c43439660fc8d6fa3b8c022e1876`) identified useful review concerns only; that package, its search engine, and its data are not runtime dependencies.

Primary references:

- W3C, WCAG 2.2: https://www.w3.org/TR/WCAG22/
- W3C, ARIA Authoring Practices Guide: https://www.w3.org/WAI/ARIA/apg/
- Apple, Human Interface Guidelines — Accessibility: https://developer.apple.com/design/human-interface-guidelines/accessibility
- Apple, Human Interface Guidelines — Motion: https://developer.apple.com/design/human-interface-guidelines/motion
- web.dev, Cumulative Layout Shift: https://web.dev/articles/cls
