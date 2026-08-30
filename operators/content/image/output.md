# Output

Return the image, saved prompt, encoded claim references, deterministic readability inspection, and exact evidence; or a typed not-needed/blocked result.

## Contract fields

- `output.outcome`: Typed visual result consumed by the content Skill.
- `output.generator`: Image-generation mechanism used for the artifact, or null when no image is needed.
- `output.imageRef`: Generated image reference, or null when unavailable or disabled.
- `output.promptRef`: Exact saved generation prompt reference, or null when disabled.
- `output.claimRefs`: Frozen brief claims encoded in the visual.
- `output.inspection`: Deterministic visual inspection result before final independent review.
- `output.evidenceRefs`: Exact image, prompt, and inspection evidence references.
- `output.reason`: Bounded blocker or not-needed reason, otherwise null.
