# Bàn thực thi nghĩa vụ lưu giữ và disposition

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | retention-obligation-disposition-workbench |
| Family | work |
| Dominant task | Áp dụng retention authority cho record cohort, resolve hold, preview delete, transfer hoặc anonymize outcome và tạo execution certificate. |
| Search aliases | retention-obligation-disposition-workbench; records disposition; hold veto; disposition certificate |
| Authority | Dominant-task topology, region graph, responsive transformation, interaction parity và state families. |

### Bất biến

- Áp dụng retention authority cho record cohort, resolve hold, preview delete, transfer hoặc anonymize outcome và tạo execution certificate.
- Mỗi required region có một semantic owner; supporting context không lấy dominant task.
- DOM order, reading order và focus order giữ nguyên meaning qua wide, intermediate và compact.
- Grammar cung cấp product facts; Principles resolve exact geometry; archetype không sở hữu visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-ROD-01 | Áp dụng retention authority cho record cohort, resolve hold, preview delete, transfer hoặc anonymize outcome và tạo execution certificate. | required positive evidence |
| AR-ROD-02 | Critical region relationship và owner separation đều có bằng chứng. | required relationship evidence |
| AR-ROD-03 | Wide relationship không còn hoạt động nhưng compact vẫn giữ task, state và recovery. | responsive transformation trigger |
| AR-ROD-04 | Error, permission, pending, success và stale/conflict đều có bounded recovery. | required state evidence |
| AR-ROD-90 | Reject retention-policy authoring, generic batch operation, account closure và data export. | reject |
| AR-ROD-91 | Khác biệt chỉ là product noun, density, color, component, state skin hoặc card count. | duplicate-or-variation |

### Quy tắc chọn

Chỉ trả accept khi AR-ROD-01, AR-ROD-02 và AR-ROD-03 có bằng chứng, không có AR-ROD-90 hoặc AR-ROD-91, và mọi required region vẫn cần thiết ở cả ba topology. Trả needs-evidence khi owner, relation hoặc transformation chưa resolve.

## Region graph

~~~text
disposition-workbench
├─ record-cohort-inventory
├─ retention-authority-clock
├─ hold-exception-register
├─ eligible-disposition-queue
├─ delete-transfer-anonymize-preview
├─ approval-execution
└─ certificate
~~~

Critical relationship: Active hold veto execution dù cohort đủ điều kiện; mọi irreversible result truy nguyên tới retention authority, cohort version, approval và certificate.

### Nghĩa vụ vùng

| Region ID | Owner | Required relationship |
|---|---|---|
| disposition-workbench | Sở hữu boundary của dominant task và chứa mọi required region mà không tạo product semantics. | Chứa record-cohort-inventory, retention-authority-clock, hold-exception-register, eligible-disposition-queue, delete-transfer-anonymize-preview, approval-execution, certificate và giữ owner độc lập của từng region. |
| record-cohort-inventory | Sở hữu membership, identity, status và current selection của collection hữu hạn này. | Nhận context từ disposition-workbench và gates retention-authority-clock mà không gộp authority. |
| retention-authority-clock | Sở hữu state và obligation của stage được đặt tên; không lấy authority của region lân cận. | Nhận context từ record-cohort-inventory và gates hold-exception-register mà không gộp authority. |
| hold-exception-register | Sở hữu membership, identity, status và current selection của collection hữu hạn này. | Nhận context từ retention-authority-clock và gates eligible-disposition-queue mà không gộp authority. |
| eligible-disposition-queue | Sở hữu membership, identity, status và current selection của collection hữu hạn này. | Nhận context từ hold-exception-register và gates delete-transfer-anonymize-preview mà không gộp authority. |
| delete-transfer-anonymize-preview | Sở hữu derived interpretation hoặc consequence preview; không trở thành input authority thứ hai. | Nhận context từ eligible-disposition-queue và gates approval-execution mà không gộp authority. |
| approval-execution | Sở hữu bounded outcome, receipt hoặc recovery route sau khi mọi upstream gate đã pass. | Nhận context từ delete-transfer-anonymize-preview và gates certificate mà không gộp authority. |
| certificate | Sở hữu bounded outcome, receipt hoặc recovery route sau khi mọi upstream gate đã pass. | Nhận verified state từ approval-execution và phát outcome hoặc recovery hữu hạn. |

## Responsive contract

### Wide

- Topology response: Keep cohorts, authority clocks, hold evidence, eligible queue, and disposition preview simultaneously visible.
- Failure trigger: simultaneous regions làm hẹp readable measure, che state hoặc phá named relationship.
- Navigation replacement: chưa cần khi các vùng còn đồng hiện; sticky chỉ dành cho orientation context vừa viewport.
- Sticky boundary: tự yield ở short-height và không che focused control.
- Overflow owner: page own vertical overflow; chỉ intrinsic matrix mới own bounded horizontal overflow.

### Intermediate

- Topology response: Make eligible queue and selected exception primary while clock and hold summary persist.
- Failure trigger: supporting persistence cạnh tranh primary-task measure hoặc focus.
- Navigation replacement: named trigger mở supporting dialog; Escape hoặc Cancel đóng và focus trở đúng trigger.
- Sticky boundary: persistent context tự yield ở short-height; dialog body own bounded vertical overflow.
- Overflow owner: page giữ vertical overflow; supporting dialog chỉ own overflow bên trong boundary của nó.

### Compact

- Topology response: Stage cohort, authority clock and holds, disposition preview, approval, execution, then certificate.
- Failure trigger: multi-pane relation không còn operable với body text 16px và target 44px.
- Navigation replacement: Previous, Next và stage selector thay pane adjacency; Back giữ selection, draft và recovery state.
- Sticky boundary: không fixed action bar; focused content luôn visible.
- Overflow owner: không page-level horizontal scroll; intrinsic matrix trở thành grouped records.

### Reflow

Thứ tự region graph là DOM order và reading order ở mọi width. CSS không reorder semantics. Text, localization, zoom và spacing growth làm region cao hơn hoặc trigger topology change; content không bị clip. State sống qua việc region đi vào hoặc ra supporting pane.

### Tương đương tương tác

Wide, intermediate và compact cung cấp cùng action, selection, pending guard, success, error, retry, stale/conflict recovery và outcome. Dynamic status được announce bằng polite live region mà không cướp focus. Modal giữ focus, hỗ trợ Escape hoặc Cancel và trả focus đúng trigger.

## Nghĩa vụ trạng thái

Domain state catalog giữ stable identifiers để EN/VI/context đồng bộ: cohort loading; clock running/matured; hold active/released/conflicting; disposition eligible/blocked; preview ready/stale; approval pending/denied; execution partial/failure/success; certificate.

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
| domain states | Giữ đầy đủ state identifiers: cohort loading; clock running/matured; hold active/released/conflicting; disposition eligible/blocked; preview ready/stale; approval pending/denied; execution partial/failure/success; certificate. | Mọi modal trả focus đúng trigger. | Giữ action và recovery parity. |

## Ranh giới

### Chấp nhận

Accept khi dominant task cần chính region graph này, critical relationship tạo topology riêng, và mọi responsive state giữ task cùng recovery parity.

### Từ chối

Reject retention-policy authoring, generic batch operation, account closure và data export. Cũng reject duplicate-or-variation khi candidate chỉ đổi noun, density, component hoặc visual state.

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
| [NARA — Records Scheduling and Appraisal](https://www.archives.gov/records-mgmt/sch-appraisal) | Hỗ trợ approved disposition authority and temporary or permanent outcomes. | Không chứng minh product facts, geometry, breakpoint hoặc visual direction. |
| [NIST — SP 800-88 Rev. 2](https://csrc.nist.gov/pubs/sp/800/88/r2/final) | Hỗ trợ current sanitization and disposal controls. | Không chứng minh product facts, geometry, breakpoint hoặc visual direction. |
| [W3C WAI — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Hỗ trợ accessible execution, failure, and certificate announcements. | Không chứng minh product facts, geometry, breakpoint hoặc visual direction. |

## Output

~~~json
{
  "archetypeId": "retention-obligation-disposition-workbench",
  "matchedSituationCodes": [
    "AR-ROD-01",
    "AR-ROD-02",
    "AR-ROD-03"
  ],
  "aliases": [
    "retention-obligation-disposition-workbench",
    "records disposition",
    "hold veto",
    "disposition certificate"
  ],
  "dominantTask": "Apply retention authority to record cohorts, resolve holds, preview delete, transfer, or anonymize outcomes, and produce an execution certificate.",
  "regions": [
    "disposition-workbench",
    "record-cohort-inventory",
    "retention-authority-clock",
    "hold-exception-register",
    "eligible-disposition-queue",
    "delete-transfer-anonymize-preview",
    "approval-execution",
    "certificate"
  ],
  "relationships": [
    "Active holds veto otherwise eligible execution; every irreversible result traces to retention authority, cohort version, approval, and certificate."
  ],
  "responsive": {
    "wide": "Keep cohorts, authority clocks, hold evidence, eligible queue, and disposition preview simultaneously visible.",
    "intermediate": "Make eligible queue and selected exception primary while clock and hold summary persist.",
    "compact": "Stage cohort, authority clock and holds, disposition preview, approval, execution, then certificate.",
    "reflow": "DOM and reading order remain stable; content grows without page-level horizontal scrolling.",
    "readingOrder": "disposition-workbench → record-cohort-inventory → retention-authority-clock → hold-exception-register → eligible-disposition-queue → delete-transfer-anonymize-preview → approval-execution → certificate",
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
    "cohort loading; clock running/matured; hold active/released/conflicting; disposition eligible/blocked; preview ready/stale; approval pending/denied; execution partial/failure/success; certificate"
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

