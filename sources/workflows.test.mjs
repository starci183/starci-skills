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

const designDeltas = `### COMPONENT DELTA

| Layer | Owner | Action | Current path | Final path | Parent / call sites | Contract | Reason |
|---|---|---|---|---|---|---|---|
| page | LearnPage | MODIFY | src/pages/LearnPage | src/pages/LearnPage | route learn | learn-page | approved composition change |

### PROPS DELTA

| Owner | Prop / API | Action | Before | After | Producers / call sites | Migration proof |
|---|---|---|---|---|---|---|
| LearnPage | public props | KEEP | LearnPageProps | LearnPageProps | route learn | typecheck and call-site search |
`

test("a v2 Plan with context and six outputs is valid", () => {
  const text = `<!-- starci-workflow: v2 -->\n\n# page\n\n## plan\n\n${context}\n${proposals}\n${outputs}`
  assert.deepEqual(validateWorkflow("designs/starci-academy/page.md", text), { legacy: false, errors: [] })
})

test("new FE design journey uses JSON session rounds without an HTML preview", () => {
  const layoutContext = context.replace("| Phase | plan |", "| Phase | layout |")
  const text = `<!-- starci-workflow: v2 -->

# page

## plan

${context}
Session id: design-1
Registry branch: codex/fe-design-registry
${outputs}

## layout

${layoutContext}
Session id: design-1
Layout round: page-a-round-1
Candidate hashes: aaa, bbb, ccc
${outputs}`
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
  const text = `<!-- starci-workflow: v2 -->\n\n# page\n\n## plan\n\n${context}\n${proposals}\n${outputs}\n## review\n\n${reviewContext}\nApproved revision: r1\n\n${designDeltas}\n${outputs}\n## apply\n\n${applyContext}\nApplied revision: r1\n\n${outputs}`
  const errors = validateWorkflow("designs/starci-academy/page.md", text).errors
  assert.ok(errors.includes("design Apply must cite Baseline commit"))
  assert.ok(errors.includes("design Apply must cite Tracked diff"))
})

test("Design Apply accepts a baseline-to-worktree diff", () => {
  const reviewContext = context.replace("| Phase | plan |", "| Phase | review |")
  const applyContext = context.replace("| Phase | plan |", "| Phase | apply |")
  const text = `<!-- starci-workflow: v2 -->\n\n# page\n\n## plan\n\n${context}\n${proposals}\n${outputs}\n## review\n\n${reviewContext}\nApproved revision: r1\n\n${designDeltas}\n${outputs}\n## apply\n\n${applyContext}\nApplied revision: r1\nBaseline commit: abc123\nTracked diff: abc123..worktree\n\n${outputs}`
  assert.deepEqual(validateWorkflow("designs/starci-academy/page.md", text), { legacy: false, errors: [] })
})

test("approved Design Review requires component and props deltas", () => {
  const reviewContext = context.replace("| Phase | plan |", "| Phase | review |")
  const text = `<!-- starci-workflow: v2 -->\n\n# page\n\n## plan\n\n${context}\n${proposals}\n${outputs}\n## review\n\n${reviewContext}\nApproved revision: r1\n\n${outputs}`
  const errors = validateWorkflow("designs/starci-academy/page.md", text).errors
  assert.ok(errors.includes("review[1]: missing COMPONENT DELTA heading"))
  assert.ok(errors.includes("review[1]: missing component delta table"))
  assert.ok(errors.includes("review[1]: missing PROPS DELTA heading"))
  assert.ok(errors.includes("review[1]: missing props delta table"))
})

test("approved Design Review rejects deferred owners and missing prop verdicts", () => {
  const reviewContext = context.replace("| Phase | plan |", "| Phase | review |")
  const deferredDeltas = designDeltas
    .replace("| LearnPage | public props | KEEP |", "| ApplyWillDecide | public props | KEEP |")
    .replace("route learn | learn-page", "** | learn-page")
  const text = `<!-- starci-workflow: v2 -->\n\n# page\n\n## plan\n\n${context}\n${proposals}\n${outputs}\n## review\n\n${reviewContext}\nApproved revision: r1\n\n${deferredDeltas}\n${outputs}`
  const errors = validateWorkflow("designs/starci-academy/page.md", text).errors
  assert.ok(errors.includes("review[1]: component delta contains deferred inventory"))
  assert.ok(errors.includes("review[1]: missing props verdict for LearnPage"))
})

test("approved Design Review rejects unknown component and prop actions", () => {
  const reviewContext = context.replace("| Phase | plan |", "| Phase | review |")
  const invalidDeltas = designDeltas
    .replace("| page | LearnPage | MODIFY |", "| widget | LearnPage | EXTEND |")
    .replace("| LearnPage | public props | KEEP |", "| LearnPage | public props | CHANGE |")
  const text = `<!-- starci-workflow: v2 -->\n\n# page\n\n## plan\n\n${context}\n${proposals}\n${outputs}\n## review\n\n${reviewContext}\nApproved revision: r1\n\n${invalidDeltas}\n${outputs}`
  const errors = validateWorkflow("designs/starci-academy/page.md", text).errors
  assert.ok(errors.includes("review[1]: unknown component layer widget"))
  assert.ok(errors.includes("review[1]: unknown component action EXTEND"))
  assert.ok(errors.includes("review[1]: unknown props action CHANGE"))
})

test("legacy workflow history remains evidence and is not rewritten", () => {
  assert.deepEqual(validateWorkflow("designs/starci-academy/old.md", "# old task\n\n## plan"), {
    legacy: true,
    errors: [],
  })
})

const fidelityContext = (phase) => context
  .replace("| Phase | plan |", `| Phase | ${phase} |`)
  .replace("/designs/starci-academy/page.md", "/fidel/starci-academy/icon.md")

const fidelityEvent = (phase, extra = "") => `## ${phase}

${fidelityContext(phase)}
Session id: fidel-1
Session status: ${phase === "finality" ? "finalized" : "open"}
${extra}
${outputs}`

test("fidelity accepts one continuous start feedback end finality session", () => {
  const related = `### RELATED BUGS

| Finding | Evidence | Classification | Route |
|---|---|---|---|
| None | focused owner scan | not-a-bug | None |
`
  const text = `<!-- starci-workflow: v2 -->

${fidelityEvent("start")}
${fidelityEvent("feedback")}
${fidelityEvent("end", related)}
${fidelityEvent("finality", "Session finalized: fidel-1")}`
  assert.deepEqual(validateWorkflow("fidel/starci-academy/icon.md", text), { legacy: false, errors: [] })
})

test("fidelity End requires a related-bug scan", () => {
  const text = `<!-- starci-workflow: v2 -->

${fidelityEvent("start")}
${fidelityEvent("end")}`
  const errors = validateWorkflow("fidel/starci-academy/icon.md", text).errors
  assert.ok(errors.includes("end[1]: missing RELATED BUGS heading"))
  assert.ok(errors.includes("end[1]: missing related bugs table"))
})

test("fidelity Finality requires the latest event to be End", () => {
  const text = `<!-- starci-workflow: v2 -->

${fidelityEvent("start")}
${fidelityEvent("feedback")}
${fidelityEvent("finality", "Session finalized: fidel-1")}`
  assert.ok(validateWorkflow("fidel/starci-academy/icon.md", text).errors.includes(
    "finality[2]: finality requires the latest event to be end",
  ))
})

test("fidelity rejects feedback appended after Finality", () => {
  const related = `### RELATED BUGS

| Finding | Evidence | Classification | Route |
|---|---|---|---|
| None | focused owner scan | not-a-bug | None |
`
  const text = `<!-- starci-workflow: v2 -->

${fidelityEvent("start")}
${fidelityEvent("end", related)}
${fidelityEvent("finality", "Session finalized: fidel-1")}
${fidelityEvent("feedback")}`
  assert.ok(validateWorkflow("fidel/starci-academy/icon.md", text).errors.includes(
    "feedback[3]: finalized fidelity session cannot receive more events",
  ))
})
