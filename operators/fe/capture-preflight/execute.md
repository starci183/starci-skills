# Execute `fe/capture-preflight`

Validate capture mechanics before AI review. Freeze the exact matrix fingerprint and owner-partition fingerprint. Check real data, skeleton/loading/steady identity, state content, control effects, page and bounded scroll restoration, zoom restoration, probe completeness, raster uniqueness, and the unmodified host handoff surface.

The ten readiness checks are binary mechanics, not a ten-point visual-quality rubric. Never summarize
them as `x/10`, a percentage, a star rating, or a UI-quality claim. `ready` requires all ten exact
checks to pass; one failed or missing check returns a non-ready outcome with `result: null`. This
operator never emits or implies a visual-quality score or verdict.

Every `reuse` partition must carry dependency proof that the latest mutation cannot affect it. Every shared sentinel is recaptured. Do not infer visual quality and do not call a reviewer. A failed deterministic check routes to source repair or backend authority; an invalid capture contract blocks. Round purposes are fixed: 1 discovery, 2 verification, 3 regression.
