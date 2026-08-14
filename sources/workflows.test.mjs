import assert from "node:assert/strict"
import test from "node:test"

import { validateWorkflow } from "../scripts/validate-workflows.mjs"

const context = `### CONTEXT

| Field | Value |
|---|---|
| Workdir | repo |
| Trust | repo/.claude |
| App | starci-academy |
| Repo / branch | repo / main |
| Purpose | settle one page |
| Workflow | .workflows/designs/starci-academy/page.md |
| Phase | plan |
| Touching | workflow only |
`

const outputs = `### OUTPUTS
| Concept | Result |
|---|---|
| page brief | settled |

### CHANGES
| Tree | Details |
|---|---|
| workflow | modified |

### NEED APPROVALS
| Question | Options |
|---|---|
| None | None |

### WARNINGS
| Warning | Impact |
|---|---|
| None | None |

### REJECTED
| Rejected | Instead | Why |
|---|---|---|
| None | None | None |

### OWED
| Owed | Cleared by |
|---|---|
| None | None |
`

test("a v2 Plan with context and six outputs is valid", () => {
  const text = `<!-- starci-workflow: v2 -->\n\n# page\n\n## plan\n\n${context}\n${outputs}`
  assert.deepEqual(validateWorkflow("designs/starci-academy/page.md", text), { legacy: false, errors: [] })
})

test("Apply cannot exist without an approved Review revision", () => {
  const applyContext = context.replace("| Phase | plan |", "| Phase | apply |")
  const text = `<!-- starci-workflow: v2 -->\n\n# page\n\n## plan\n\n${context}\n${outputs}\n## apply\n\n${applyContext}\nApplied revision: r1\n\n${outputs}`
  assert.ok(validateWorkflow("designs/starci-academy/page.md", text).errors.includes(
    "apply requires an earlier Review with Approved revision",
  ))
})

test("Design Apply requires the baseline commit and tracked worktree diff", () => {
  const reviewContext = context.replace("| Phase | plan |", "| Phase | review |")
  const applyContext = context.replace("| Phase | plan |", "| Phase | apply |")
  const text = `<!-- starci-workflow: v2 -->\n\n# page\n\n## plan\n\n${context}\n${outputs}\n## review\n\n${reviewContext}\nApproved revision: r1\n\n${outputs}\n## apply\n\n${applyContext}\nApplied revision: r1\n\n${outputs}`
  const errors = validateWorkflow("designs/starci-academy/page.md", text).errors
  assert.ok(errors.includes("design Apply must cite Baseline commit"))
  assert.ok(errors.includes("design Apply must cite Tracked diff"))
})

test("Design Apply accepts a baseline-to-worktree diff", () => {
  const reviewContext = context.replace("| Phase | plan |", "| Phase | review |")
  const applyContext = context.replace("| Phase | plan |", "| Phase | apply |")
  const text = `<!-- starci-workflow: v2 -->\n\n# page\n\n## plan\n\n${context}\n${outputs}\n## review\n\n${reviewContext}\nApproved revision: r1\n\n${outputs}\n## apply\n\n${applyContext}\nApplied revision: r1\nBaseline commit: abc123\nTracked diff: abc123..worktree\n\n${outputs}`
  assert.deepEqual(validateWorkflow("designs/starci-academy/page.md", text), { legacy: false, errors: [] })
})

test("legacy workflow history remains evidence and is not rewritten", () => {
  assert.deepEqual(validateWorkflow("designs/starci-academy/old.md", "# old task\n\n## plan"), {
    legacy: true,
    errors: [],
  })
})
