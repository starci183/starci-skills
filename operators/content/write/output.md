# Output

Return written article editions, covered learning outcomes, a substantive interview-question count, exact evidence, and Luna execution provenance.

## Contract fields

- `output.outcome`: Typed writing result consumed by the content Skill.
- `output.aiExecution`: Runtime-attested Luna writing execution.
- `output.articleRefs`: Inspectible article edition references, or empty when blocked.
- `output.coveredOutcomeRefs`: Teacher-brief learning outcomes explicitly covered by the article.
- `output.interviewQuestionCount`: Number of substantive interview questions included across beginner and follow-up depth.
- `output.evidenceRefs`: Exact writing artifacts and trace evidence.
- `output.reason`: Bounded blocker reason, otherwise null.
