# Analyze frontend UI-direction input

Validate that the request needs visual ideation, the business authority is fresh, the normalized target
is exact, and three or four directions are requested. When the normalized `scopeUnit` is `branch`,
`journey` or `feature`, require a closed set of applicable surface roles rather than silently reducing the
work to the current page. Candidate roles are entry, core task, pending/recovery, result,
history/retry/resume and exit; omit roles that the approved business outcome does not need. Every
direction must render the important surfaces and relationships in that closed set. Do not load UX-flow,
Grammar object detail, or source files. Enter fixed state `generate`.
