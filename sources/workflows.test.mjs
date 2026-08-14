import assert from "node:assert/strict"
import test from "node:test"

import { validateWorkflow } from "../scripts/validate-workflows.mjs"

const context = `### CONTEXT

| Field | Value |
|---|---|
| Workdir | repo |
| Source | /workspace/backend |
| Project | starci-academy |
| Frontend | /workspace/frontend |
| Backend | /workspace/backend |
| Trust | /workspace/backend/.claude |
| Skills | /workspace/backend/.claude/skills |
| App | starci-academy |
| Repo / branch | repo / main |
| Purpose | settle one page |
| Workflow root | /workspace/backend/.workflows |
| Workflow | /workspace/backend/.workflows/designs/starci-academy/page.md |
| Language | vi |
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

const proposals = `| Preview | URL | HTML | SHA-256 | Status |
|---|---|---|---|---|
| learn-r1 | http://127.0.0.1:8080/ | /preview/index.html | aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa | đang chờ |

| Direction | Tab | Status |
|---|---|---|
| A | Tổng quan | đang chờ |
| B | Theo lộ trình | đang chờ |
`

test("a v2 Plan with context and six outputs is valid", () => {
  const text = `<!-- starci-workflow: v2 -->\n\n# page\n\n## plan\n\n${context}\n${proposals}\n${outputs}`
  assert.deepEqual(validateWorkflow("designs/starci-academy/page.md", text), { legacy: false, errors: [] })
})

test("Design Plan allows one preview URL only", () => {
  const duplicatedPreview = proposals.replace(
    "| learn-r1 | http://127.0.0.1:8080/ | /preview/index.html | aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa | đang chờ |",
    "| learn-r1 | http://127.0.0.1:8080/ | /preview/index.html | aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa | đang chờ |\n| learn-r1-copy | http://127.0.0.1:8081/ | /preview/copy/index.html | bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb | đang chờ |",
  )
  const text = `<!-- starci-workflow: v2 -->\n\n# page\n\n## plan\n\n${context}\n${duplicatedPreview}\n${outputs}`
  assert.ok(validateWorkflow("designs/starci-academy/page.md", text).errors.includes(
    "plan[0]: design requires exactly one preview URL",
  ))
})

test("Apply cannot exist without an approved Review revision", () => {
  const applyContext = context.replace("| Phase | plan |", "| Phase | apply |")
  const text = `<!-- starci-workflow: v2 -->\n\n# page\n\n## plan\n\n${context}\n${proposals}\n${outputs}\n## apply\n\n${applyContext}\nApplied revision: r1\n\n${outputs}`
  assert.ok(validateWorkflow("designs/starci-academy/page.md", text).errors.includes(
    "apply requires an earlier Review with Approved revision",
  ))
})

test("Design Apply requires the baseline commit and tracked worktree diff", () => {
  const reviewContext = context.replace("| Phase | plan |", "| Phase | review |")
  const applyContext = context.replace("| Phase | plan |", "| Phase | apply |")
  const text = `<!-- starci-workflow: v2 -->\n\n# page\n\n## plan\n\n${context}\n${proposals}\n${outputs}\n## review\n\n${reviewContext}\nApproved revision: r1\n\n${outputs}\n## apply\n\n${applyContext}\nApplied revision: r1\n\n${outputs}`
  const errors = validateWorkflow("designs/starci-academy/page.md", text).errors
  assert.ok(errors.includes("design Apply must cite Baseline commit"))
  assert.ok(errors.includes("design Apply must cite Tracked diff"))
})

test("Design Apply accepts a baseline-to-worktree diff", () => {
  const reviewContext = context.replace("| Phase | plan |", "| Phase | review |")
  const applyContext = context.replace("| Phase | plan |", "| Phase | apply |")
  const text = `<!-- starci-workflow: v2 -->\n\n# page\n\n## plan\n\n${context}\n${proposals}\n${outputs}\n## review\n\n${reviewContext}\nApproved revision: r1\n\n${outputs}\n## apply\n\n${applyContext}\nApplied revision: r1\nBaseline commit: abc123\nTracked diff: abc123..worktree\n\n${outputs}`
  assert.deepEqual(validateWorkflow("designs/starci-academy/page.md", text), { legacy: false, errors: [] })
})

test("legacy workflow history remains evidence and is not rewritten", () => {
  assert.deepEqual(validateWorkflow("designs/starci-academy/old.md", "# old task\n\n## plan"), {
    legacy: true,
    errors: [],
  })
})
