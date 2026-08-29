# `test/ui-audit` output

The output contains one typed outcome, immutable result/evidence refs, structured findings, contiguous visible Browser case results, optional flow coverage, exact user actions, optional finite UI questions, independent UI/Grammar verdicts, and a blocker reason.

## Contract fields

- `output.outcome`: Typed audit result consumed by the parent Skill machine.
- `output.resultRef`: Exact immutable audit artifact reference, or null.
- `output.evidenceRefs`: Exact read-only evidence supporting the audit.
- `output.findings`: Structured observable audit findings.
- `output.caseResults`: Predeclared visible Browser executions in contiguous order.
- `output.coverageSummary`: Flow coverage compilation, or null outside flow coverage.
- `output.suspenseQuestions`: Finite UI authority questions; empty for every non-UI or non-suspense result.
- `output.userActions`: Exact resumable user actions when user control is required.
- `output.authorityVerdicts`: Independent UI-principles and Grammar verdicts, or null outside UI audit.
- `output.reason`: Bounded blocker explanation, otherwise null.
