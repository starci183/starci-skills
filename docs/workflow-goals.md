# Workflow goals: brief in chat, full specification in a file

Every bounded workflow presents two consistent views of the same goal:

- The full English goal remains in its existing Plan bundle or standalone
  workflow `goal.yaml`. Supply a readable
  rendering in the configured user language with all sections and tables intact.
- The task chat starts with a concise explanation of the current workflow. Link
  both artifacts so the user can scan the brief or inspect the complete scope.

Apply this at each workflow checkpoint, whether standalone or inside a Plan.
Do not replace the brief with an opened YAML panel or a report to a coordinator.
Do not duplicate the complete Plan in chat unless the user asks for it.

For a standalone workflow, link its `goal.yaml` and readable detail directly;
see [standalone workflow](standalone-workflow.md). Do not create a Plan merely to
use the export command. For a Plan-bound workflow, export the selected workflow
and complete Plan for delivery with:

```text
node scripts/present-goal.mjs <goal/index.yaml> <job-id> <new-local-presentation-directory>
```

Keep presentations under the existing Plan's `_local` location, for example
`<plan>/presentations/<job-id>-<revision>/`. The command creates `goal.yaml`
(byte-identical full source goal), `goal.md` (selected workflow detail and full
Plan), and `presentation.yaml` (source hash and selected job identity).
It refuses a stale Plan digest, unknown job, links or existing destination;
it never creates approvals, runs or a replacement Plan. A Plan-stage proposal
is labelled as such, not as a frozen/approved executable goal. Before approval,
verify the exported source hash still matches the canonical goal and use the
existing approval protocol, not the presentation metadata. Translate the readable
prose to the configured language without changing the goal's scope or criteria.

Link `goal.yaml` and the readable document from the short in-chat brief. The
canonical `goal/index.yaml` remains the sole execution authority source; the
export's name is for convenient user delivery, not another editable goal state.

## Example (illustrative, not an approved product goal)

Goal `chatbot-control-recovery` — sửa backend để khi người vận hành tiếp quản,
bot ngừng bắt đầu lượt gửi mới nhưng vẫn theo dõi lượt đang gửi.

- Kết quả: takeover và phục hồi không làm gửi trùng; lượt chưa xác minh vẫn chờ.
- Phạm vi: backend Chatbot và test; không sửa frontend, nghiệp vụ hay production.
- Đạt khi: unit, PostgreSQL integration và API E2E qua cả takeover, mất kết quả,
  gửi lại và cô lập hai installation.
- Ước lượng: 2–4 giờ, phụ thuộc test DB; bước sau là tích hợp delivery/referral.
- Trạng thái: đang trình duyệt goal này; chưa bắt đầu sửa source.
- Goal đầy đủ: [link tới goal cụ thể]. Bản đọc: [link tới bản render đầy đủ].

Replace illustrative links with real retrievable artifacts. Include important
risks or remaining decisions in the brief, even if that makes it slightly longer.
For auto, state the valid delegation and current risk assessment instead of
inventing a new manual checkpoint. For an unchanged approved goal on resume,
summarize progress and the next action without asking the same approval again.

The summary cannot broaden effects, conceal a changed goal, replace acceptance
checks, or create approval. Detailed write sets, hashes and matrices stay in the
full document; the actual approval still binds the exact presented goal.
