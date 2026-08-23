# Bàn kiểm thử assurance cho control

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | control-assurance-testing-workbench |
| Family | work |
| Dominant task | Thực thi assurance procedure lặp lại trên nhiều sample, gắn evidence, ghi exception và chứng minh assertion coverage trước reviewer sign-off. |
| Search aliases | control-assurance-testing-workbench; control testing; assurance procedure; sample evidence coverage |
| Authority | Dominant-task topology, region graph, responsive transformation, interaction parity và state families. |

### Bất biến

- Thực thi assurance procedure lặp lại trên nhiều sample, gắn evidence, ghi exception và chứng minh assertion coverage trước reviewer sign-off.
- Mỗi required region có một semantic owner; supporting context không lấy dominant task.
- DOM order, reading order và focus order giữ nguyên meaning qua wide, intermediate và compact.
- Grammar cung cấp product facts; Principles resolve exact geometry; archetype không sở hữu visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-CAT-01 | Thực thi assurance procedure lặp lại trên nhiều sample, gắn evidence, ghi exception và chứng minh assertion coverage trước reviewer sign-off. | required positive evidence |
| AR-CAT-02 | Critical region relationship và owner separation đều có bằng chứng. | required relationship evidence |
| AR-CAT-03 | Wide relationship không còn hoạt động nhưng compact vẫn giữ task, state và recovery. | responsive transformation trigger |
| AR-CAT-04 | Error, permission, pending, success và stale/conflict đều có bounded recovery. | required state evidence |
| AR-CAT-90 | Reject one-case dossier, diagnostic bundle, assessment, regulated sample selection và generic checklist. | reject |
| AR-CAT-91 | Khác biệt chỉ là product noun, density, color, component, state skin hoặc card count. | duplicate-or-variation |

### Quy tắc chọn

Chỉ trả accept khi AR-CAT-01, AR-CAT-02 và AR-CAT-03 có bằng chứng, không có AR-CAT-90 hoặc AR-CAT-91, và mọi required region vẫn cần thiết ở cả ba topology. Trả needs-evidence khi owner, relation hoặc transformation chưa resolve.

## Region graph

~~~text
assurance-workbench
├─ control-test-plan
├─ sample-population
├─ procedure-steps
├─ evidence-viewer
├─ result-exception-ledger
├─ assertion-coverage
└─ reviewer-signoff
~~~

Critical relationship: Kết quả procedure lặp lại trên sample roll up vào một assertion owner; thiếu evidence hoặc exception còn mở chặn sufficient coverage và sign-off.

### Nghĩa vụ vùng

| Region ID | Owner | Required relationship |
|---|---|---|
| assurance-workbench | Sở hữu boundary của dominant task và chứa mọi required region mà không tạo product semantics. | Chứa control-test-plan, sample-population, procedure-steps, evidence-viewer, result-exception-ledger, assertion-coverage, reviewer-signoff và giữ owner độc lập của từng region. |
| control-test-plan | Sở hữu state và obligation của stage được đặt tên; không lấy authority của region lân cận. | Nhận context từ assurance-workbench và gates sample-population mà không gộp authority. |
| sample-population | Sở hữu membership, identity, status và current selection của collection hữu hạn này. | Nhận context từ control-test-plan và gates procedure-steps mà không gộp authority. |
| procedure-steps | Sở hữu state và obligation của stage được đặt tên; không lấy authority của region lân cận. | Nhận context từ sample-population và gates evidence-viewer mà không gộp authority. |
| evidence-viewer | Sở hữu source evidence, provenance, freshness và availability; không tự quyết định outcome. | Nhận context từ procedure-steps và gates result-exception-ledger mà không gộp authority. |
| result-exception-ledger | Sở hữu membership, identity, status và current selection của collection hữu hạn này. | Nhận context từ evidence-viewer và gates assertion-coverage mà không gộp authority. |
| assertion-coverage | Sở hữu derived interpretation hoặc consequence preview; không trở thành input authority thứ hai. | Nhận context từ result-exception-ledger và gates reviewer-signoff mà không gộp authority. |
| reviewer-signoff | Sở hữu bounded outcome, receipt hoặc recovery route sau khi mọi upstream gate đã pass. | Nhận verified state từ assertion-coverage và phát outcome hoặc recovery hữu hạn. |

## Responsive contract

### Wide

- Topology response: Keep sample and procedure context, evidence, results, exceptions, and assertion coverage simultaneously inspectable.
- Failure trigger: simultaneous regions làm hẹp readable measure, che state hoặc phá named relationship.
- Navigation replacement: chưa cần khi các vùng còn đồng hiện; sticky chỉ dành cho orientation context vừa viewport.
- Sticky boundary: tự yield ở short-height và không che focused control.
- Overflow owner: page own vertical overflow; chỉ intrinsic matrix mới own bounded horizontal overflow.

### Intermediate

- Topology response: Move the sample queue to a drawer; keep the active procedure and evidence primary while coverage persists.
- Failure trigger: supporting persistence cạnh tranh primary-task measure hoặc focus.
- Navigation replacement: named trigger mở supporting dialog; Escape hoặc Cancel đóng và focus trở đúng trigger.
- Sticky boundary: persistent context tự yield ở short-height; dialog body own bounded vertical overflow.
- Overflow owner: page giữ vertical overflow; supporting dialog chỉ own overflow bên trong boundary của nó.

### Compact

- Topology response: Stage one sample, one procedure step, evidence, result or exception, next sample, then coverage and sign-off.
- Failure trigger: multi-pane relation không còn operable với body text 16px và target 44px.
- Navigation replacement: Previous, Next và stage selector thay pane adjacency; Back giữ selection, draft và recovery state.
- Sticky boundary: không fixed action bar; focused content luôn visible.
- Overflow owner: không page-level horizontal scroll; intrinsic matrix trở thành grouped records.

### Reflow

Thứ tự region graph là DOM order và reading order ở mọi width. CSS không reorder semantics. Text, localization, zoom và spacing growth làm region cao hơn hoặc trigger topology change; content không bị clip. State sống qua việc region đi vào hoặc ra supporting pane.

### Tương đương tương tác

Wide, intermediate và compact cung cấp cùng action, selection, pending guard, success, error, retry, stale/conflict recovery và outcome. Dynamic status được announce bằng polite live region mà không cướp focus. Modal giữ focus, hỗ trợ Escape hoặc Cancel và trả focus đúng trigger.

## Nghĩa vụ trạng thái

Domain state catalog giữ stable identifiers để EN/VI/context đồng bộ: plan loading; sample pending/in-test/complete; procedure pass/fail/not-applicable; evidence missing/invalid; exception open/cleared; coverage insufficient/sufficient; reviewer changes requested; sign-off.

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
| domain states | Giữ đầy đủ state identifiers: plan loading; sample pending/in-test/complete; procedure pass/fail/not-applicable; evidence missing/invalid; exception open/cleared; coverage insufficient/sufficient; reviewer changes requested; sign-off. | Mọi modal trả focus đúng trigger. | Giữ action và recovery parity. |

## Ranh giới

### Chấp nhận

Accept khi dominant task cần chính region graph này, critical relationship tạo topology riêng, và mọi responsive state giữ task cùng recovery parity.

### Từ chối

Reject one-case dossier, diagnostic bundle, assessment, regulated sample selection và generic checklist. Cũng reject duplicate-or-variation khi candidate chỉ đổi noun, density, component hoặc visual state.

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
| [NIST — SP 800-53A Rev. 5](https://csrc.nist.gov/pubs/sp/800/53/a/r5/final) | Hỗ trợ repeatable assessment procedures and assessment plans. | Không chứng minh product facts, geometry, breakpoint hoặc visual direction. |
| [IBM Carbon — Data table usage](https://carbondesignsystem.com/components/data-table/usage/) | Hỗ trợ dense record collections with explicit selection and state. | Không chứng minh product facts, geometry, breakpoint hoặc visual direction. |
| [W3C WAI — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Hỗ trợ non-disruptive procedure, exception, and coverage announcements. | Không chứng minh product facts, geometry, breakpoint hoặc visual direction. |

## Output

~~~json
{
  "archetypeId": "control-assurance-testing-workbench",
  "matchedSituationCodes": [
    "AR-CAT-01",
    "AR-CAT-02",
    "AR-CAT-03"
  ],
  "aliases": [
    "control-assurance-testing-workbench",
    "control testing",
    "assurance procedure",
    "sample evidence coverage"
  ],
  "dominantTask": "Execute repeatable assurance procedures across samples, bind evidence, record exceptions, and prove assertion coverage before reviewer sign-off.",
  "regions": [
    "assurance-workbench",
    "control-test-plan",
    "sample-population",
    "procedure-steps",
    "evidence-viewer",
    "result-exception-ledger",
    "assertion-coverage",
    "reviewer-signoff"
  ],
  "relationships": [
    "Repeated sample results roll up to one assertion owner; missing evidence or open exceptions prevent sufficient coverage and sign-off."
  ],
  "responsive": {
    "wide": "Keep sample and procedure context, evidence, results, exceptions, and assertion coverage simultaneously inspectable.",
    "intermediate": "Move the sample queue to a drawer; keep the active procedure and evidence primary while coverage persists.",
    "compact": "Stage one sample, one procedure step, evidence, result or exception, next sample, then coverage and sign-off.",
    "reflow": "DOM and reading order remain stable; content grows without page-level horizontal scrolling.",
    "readingOrder": "assurance-workbench → control-test-plan → sample-population → procedure-steps → evidence-viewer → result-exception-ledger → assertion-coverage → reviewer-signoff",
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
    "plan loading; sample pending/in-test/complete; procedure pass/fail/not-applicable; evidence missing/invalid; exception open/cleared; coverage insufficient/sufficient; reviewer changes requested; sign-off"
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

