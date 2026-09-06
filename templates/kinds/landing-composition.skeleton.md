# landing-composition — landing-id

One paragraph naming the promise, the bound Grammar family, the canonical visual identity evidence
and the landing story this contract composes. Written by `landing.compose`; it contains no source.

## Authority

| Field | Value |
| --- | --- |
| Business promise | the concrete promise the landing makes credible |
| Grammar family | the bound family and version |
| Visual identity | canonical asset, brand system or explicit identity description |

## Grammar adoption

| Section | Element | Owner | Binding or reason |
| --- | --- | --- | --- |
| `hero` | heading and body copy | grammar | `Heading` and `Text` |
| `hero` | primary and secondary actions | grammar | `Button` and `TextAction` |
| `hero` | status label | grammar | `Badge` |
| `hero` | responsibility graph | custom | brand-specific narrative visualization outside the component family |
| `proof` | icons and colour values | grammar | `Icon` and semantic tokens |

## Visual storyboard

| Order | Section | Narrative job | Visual event | Proof |
| --- | --- | --- | --- | --- |
| 01 | `hero` | state the promise | brand character activates the responsibility graph | promise and identity are visible before the fold |
| 02 | `operating-loop` | explain the mechanism | the path advances from context to trust | every step remains readable without motion |
| 03 | `roles` | show transfer of responsibility | human, AI and system layers hand work forward | owner and outcome stay paired |

## Asset strategy

| Slot | Decision | Identity evidence | Brief |
| --- | --- | --- | --- |
| `hero-brand-art` | imagegen | canonical mascot asset | preserve identity exactly; change only rendering medium and scene |
| `responsibility-graph` | code-native | semantic token and Grammar family | responsive nodes and edges with DOM-readable labels |

## Motion choreography

| Section | Trigger | Choreography | Reduced motion | Performance budget |
| --- | --- | --- | --- | --- |
| `hero` | first paint | graph nodes reveal after the static brand artwork | show final state immediately; no drift | transform and opacity only; no layout shift |
| `operating-loop` | section enters viewport | illuminate steps once in reading order | keep the complete path static | one observer and bounded stagger |

## Audit contract

| Concern | Evidence | Failure route |
| --- | --- | --- |
| visual storytelling | screenshots prove every section advances one narrative job | direction |
| motion | capture and timing prove choreography preserves reading order | resolve |
| reduced motion | reduced-motion capture shows all content in its final state | resolve |
| performance | trace shows bounded assets, stable layout and compositor-safe motion | direction |

## Ownership handoff

| Operator | Owns | Must not |
| --- | --- | --- |
| landing.compose | the read-only landing composition contract | write source or generate final assets |
| interface.generate | implementation, generated assets and one source commit | silently replace the contract's promise or identity |
| interface.audit | rendered evidence and verdicts | compose a replacement direction or repair source |

## Fallbacks taken

| Code | Action |
| --- | --- |
