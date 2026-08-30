# Input

Provide frozen brief claims, written article references, optional style evidence, output targets, image mode, and exact visual revision findings.

## Contract fields

- `context.briefRefs`: Exact frozen teacher and visual-claim references.
- `context.articleRefs`: Exact written article references from which labels may be derived.
- `context.styleRefs`: Exact visual style or supplied reference-image evidence.
- `input.mode`: Whether an image is required, optional, or disabled.
- `input.imageTargetRef`: Bounded output image reference, or null when disabled.
- `input.promptTargetRef`: Bounded generation-prompt evidence reference, or null when disabled.
- `input.revisionFindingRefs`: Exact final-review visual findings to fix.
