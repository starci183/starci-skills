# Bàn soạn thảo nghĩa vụ chính sách

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | policy-obligation-authoring-workbench |
| Family | work |
| Dominant task | Soạn policy clause đồng thời truy nguyên obligation, owner, evidence requirement và downstream control impact. |
| Search aliases | policy-obligation-authoring-workbench; policy clause authoring; obligation traceability; control impact |
| Authority | Dominant-task topology, region graph, responsive transformation, interaction parity và state families. |

### Bất biến

- Soạn policy clause đồng thời truy nguyên obligation, owner, evidence requirement và downstream control impact.
- Mỗi required region có một semantic owner; supporting context không lấy dominant task.
- DOM order, reading order và focus order giữ nguyên meaning qua wide, intermediate và compact.
- Grammar cung cấp product facts; Principles resolve exact geometry; archetype không sở hữu visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-POW-01 | Soạn policy clause đồng thời truy nguyên obligation, owner, evidence requirement và downstream control impact. | required positive evidence |
| AR-POW-02 | Critical region relationship và owner separation đều có bằng chứng. | required relationship evidence |
| AR-POW-03 | Wide relationship không còn hoạt động nhưng compact vẫn giữ task, state và recovery. | responsive transformation trigger |
| AR-POW-04 | Error, permission, pending, success và stale/conflict đều có bounded recovery. | required state evidence |
| AR-POW-90 | Reject generic outline editor, rule builder, retention planner, evidence dossier và authored analytical briefing. | reject |
| AR-POW-91 | Khác biệt chỉ là product noun, density, color, component, state skin hoặc card count. | duplicate-or-variation |

### Quy tắc chọn

Chỉ trả accept khi AR-POW-01, AR-POW-02 và AR-POW-03 có bằng chứng, không có AR-POW-90 hoặc AR-POW-91, và mọi required region vẫn cần thiết ở cả ba topology. Trả needs-evidence khi owner, relation hoặc transformation chưa resolve.

## Region graph

~~~text
policy-workbench
├─ policy-outline
├─ clause-editor
├─ obligation-role-evidence-ledger
├─ dependency-control-impact
├─ reviewer-comments
└─ version-approval-publish
~~~

Critical relationship: Clause prose và obligation-role-evidence ledger là hai owner ngang hàng; mọi clause có thể publish đều truy nguyên hai chiều tới evidence và control impact.

### Nghĩa vụ vùng

| Region ID | Owner | Required relationship |
|---|---|---|
| policy-workbench | Sở hữu boundary của dominant task và chứa mọi required region mà không tạo product semantics. | Chứa policy-outline, clause-editor, obligation-role-evidence-ledger, dependency-control-impact, reviewer-comments, version-approval-publish và giữ owner độc lập của từng region. |
| policy-outline | Sở hữu state và obligation của stage được đặt tên; không lấy authority của region lân cận. | Nhận context từ policy-workbench và gates clause-editor mà không gộp authority. |
| clause-editor | Sở hữu editable decision state, validation và pending guard cho stage được đặt tên. | Nhận context từ policy-outline và gates obligation-role-evidence-ledger mà không gộp authority. |
| obligation-role-evidence-ledger | Sở hữu source evidence, provenance, freshness và availability; không tự quyết định outcome. | Nhận context từ clause-editor và gates dependency-control-impact mà không gộp authority. |
| dependency-control-impact | Sở hữu derived interpretation hoặc consequence preview; không trở thành input authority thứ hai. | Nhận context từ obligation-role-evidence-ledger và gates reviewer-comments mà không gộp authority. |
| reviewer-comments | Sở hữu state và obligation của stage được đặt tên; không lấy authority của region lân cận. | Nhận context từ dependency-control-impact và gates version-approval-publish mà không gộp authority. |
| version-approval-publish | Sở hữu bounded outcome, receipt hoặc recovery route sau khi mọi upstream gate đã pass. | Nhận verified state từ reviewer-comments và phát outcome hoặc recovery hữu hạn. |

## Responsive contract

### Wide

- Topology response: Keep policy outline, active clause, obligation ledger, impact, and comments simultaneously inspectable.
- Failure trigger: simultaneous regions làm hẹp readable measure, che state hoặc phá named relationship.
- Navigation replacement: chưa cần khi các vùng còn đồng hiện; sticky chỉ dành cho orientation context vừa viewport.
- Sticky boundary: tự yield ở short-height và không che focused control.
- Overflow owner: page own vertical overflow; chỉ intrinsic matrix mới own bounded horizontal overflow.

### Intermediate

- Topology response: Move the outline to a drawer; keep clause and synchronized obligation-impact panes primary.
- Failure trigger: supporting persistence cạnh tranh primary-task measure hoặc focus.
- Navigation replacement: named trigger mở supporting dialog; Escape hoặc Cancel đóng và focus trở đúng trigger.
- Sticky boundary: persistent context tự yield ở short-height; dialog body own bounded vertical overflow.
- Overflow owner: page giữ vertical overflow; supporting dialog chỉ own overflow bên trong boundary của nó.

### Compact

- Topology response: Stage clause authoring, atomic obligations and evidence, downstream impact, reviewer comments, and exact-version review.
- Failure trigger: multi-pane relation không còn operable với body text 16px và target 44px.
- Navigation replacement: Previous, Next và stage selector thay pane adjacency; Back giữ selection, draft và recovery state.
- Sticky boundary: không fixed action bar; focused content luôn visible.
- Overflow owner: không page-level horizontal scroll; intrinsic matrix trở thành grouped records.

### Reflow

Thứ tự region graph là DOM order và reading order ở mọi width. CSS không reorder semantics. Text, localization, zoom và spacing growth làm region cao hơn hoặc trigger topology change; content không bị clip. State sống qua việc region đi vào hoặc ra supporting pane.

### Tương đương tương tác

Wide, intermediate và compact cung cấp cùng action, selection, pending guard, success, error, retry, stale/conflict recovery và outcome. Dynamic status được announce bằng polite live region mà không cướp focus. Modal giữ focus, hỗ trợ Escape hoặc Cancel và trả focus đúng trigger.

## Nghĩa vụ trạng thái

Domain state catalog giữ stable identifiers để EN/VI/context đồng bộ: version loading; clause draft/changed/approved; obligation missing/assigned; evidence undefined; control impact unknown/conflict; comment open/resolved; publish pending/failure; superseded version.

| State family | Obligation | Focus transition | Responsive presentation |
|---|---|---|---|
| initial/loading | Giữ known anatomy và nêu region đang chờ. | Không tự move focus. | Giữ cùng stage identity. |
| ready | Hiển thị consistent fictional data và current selection. | Focus ở activating control. | Giữ selection qua transformation. |
| empty/not-applicable | Giải thích vì sao trống và valid next step. | Chỉ move đến recovery khi cần continuation. | Không xóa required region khác. |
| error/retry | Gắn error với owner và cung cấp bounded retry. | Multi-error focus vào summary; retry trả đúng action. | Error không chỉ dùng màu. |
| permission/unavailable | Giữ orientation và giải thích limitation. | Không focus locked control. | Cùng reason ở mọi topology. |
| pending | Chặn duplicate và giữ action meaning. | Không cướp focus để báo progress. | State ở cùng action owner. |
| success | Confirm outcome và valid continuation. | Chỉ move focus nếu giúp continuation. | Không tạo source of truth thứ hai. |
| stale/conflict | Nêu changed version và giữ safe input. | Focus contextual recovery choice. | Selection sống qua transformation. |
| domain states | Giữ đầy đủ state identifiers: version loading; clause draft/changed/approved; obligation missing/assigned; evidence undefined; control impact unknown/conflict; comment open/resolved; publish pending/failure; superseded version. | Mọi modal trả focus đúng trigger. | Giữ action và recovery parity. |

## Ranh giới

### Chấp nhận

Accept khi dominant task cần chính region graph này, critical relationship tạo topology riêng, và mọi responsive state giữ task cùng recovery parity.

### Từ chối

Reject generic outline editor, rule builder, retention planner, evidence dossier và authored analytical briefing. Cũng reject duplicate-or-variation khi candidate chỉ đổi noun, density, component hoặc visual state.

### Phán quyết ranh giới

Kết quả hợp lệ là accept, reject, duplicate-or-variation hoặc needs-evidence theo Situation-code rule; visual preference không phải evidence.

## Handoff

- Grammar nhận real facts, semantic owners, permissions, states và action consequences.
- Principles nhận exact grid, measure, gaps, sizing, alignment, overflow, thresholds, sticky offsets và focus accommodation.
- Direction nhận visual character; template chỉ là một conforming realization.

## Bằng chứng research không ràng buộc

### Ranh giới bằng chứng

Các official source dưới đây chỉ là advisory evidence. Chúng không phải product truth, không khẳng định source organization đặt tên archetype tổng hợp này và không cấp quyền copy geometry, component tree, noun hoặc breakpoint.

### Nguồn

| Source | What it supports | What it does not prove |
|---|---|---|
| [NIST — SP 800-53 Rev. 5](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final) | Hỗ trợ explicit controls, roles, assessment evidence, and versioned authority. | Không chứng minh product facts, geometry, breakpoint hoặc visual direction. |
| [Microsoft Support — Track changes in Word](https://support.microsoft.com/en-us/word/training/track-changes-in-word) | Hỗ trợ reviewing exact authored changes and comments. | Không chứng minh product facts, geometry, breakpoint hoặc visual direction. |
| [W3C WAI — ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/patterns/) | Hỗ trợ keyboard-operable disclosure and dialog behavior. | Không chứng minh product facts, geometry, breakpoint hoặc visual direction. |

## Output

~~~json
{
  "archetypeId": "policy-obligation-authoring-workbench",
  "matchedSituationCodes": [
    "AR-POW-01",
    "AR-POW-02",
    "AR-POW-03"
  ],
  "aliases": [
    "policy-obligation-authoring-workbench",
    "policy clause authoring",
    "obligation traceability",
    "control impact"
  ],
  "dominantTask": "Author policy clauses while tracing obligations, owners, evidence requirements, and downstream control impact.",
  "regions": [
    "policy-workbench",
    "policy-outline",
    "clause-editor",
    "obligation-role-evidence-ledger",
    "dependency-control-impact",
    "reviewer-comments",
    "version-approval-publish"
  ],
  "relationships": [
    "Clause prose and the obligation-role-evidence ledger are peer owners; every publishable clause traces both ways to evidence and control impact."
  ],
  "responsive": {
    "wide": "Keep policy outline, active clause, obligation ledger, impact, and comments simultaneously inspectable.",
    "intermediate": "Move the outline to a drawer; keep clause and synchronized obligation-impact panes primary.",
    "compact": "Stage clause authoring, atomic obligations and evidence, downstream impact, reviewer comments, and exact-version review.",
    "reflow": "DOM and reading order remain stable; content grows without page-level horizontal scrolling.",
    "readingOrder": "policy-workbench → policy-outline → clause-editor → obligation-role-evidence-ledger → dependency-control-impact → reviewer-comments → version-approval-publish",
    "navigationReplacement": "An anchored supporting pane at intermediate and a staged Previous/Next selector at compact.",
    "stickyBehavior": "Only orientation context may persist, and it yields at short height without obscuring focus.",
    "overflowOwner": "The page owns vertical overflow; no page-level horizontal overflow is allowed.",
    "interactionParity": "Every action, state, pending guard, recovery path, and focus return remains available across bands."
  },
  "stateObligations": [
    "initial/loading",
    "ready",
    "empty/not-applicable",
    "error/retry",
    "permission/unavailable",
    "pending",
    "success",
    "stale/conflict",
    "focus transition",
    "version loading; clause draft/changed/approved; obligation missing/assigned; evidence undefined; control impact unknown/conflict; comment open/resolved; publish pending/failure; superseded version"
  ],
  "boundaryVerdict": "needs-evidence",
  "grammarHandoff": [
    "product facts",
    "semantic owners",
    "permissions and consequences",
    "real state transitions"
  ],
  "principlesHandoff": [
    "exact geometry",
    "measure and overflow",
    "content-driven thresholds",
    "sticky offsets",
    "focus accommodation"
  ],
  "confidence": "high when the positive situations and critical relationship are evidenced; otherwise needs-evidence",
  "evidenceClasses": [
    "official task-domain guidance",
    "official independent design or service guidance",
    "official accessibility guidance"
  ]
}
~~~

Không trả class, token, component, source path, fixed breakpoint hoặc invented product fact.

