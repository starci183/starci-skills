# Không gian trả lời tham vấn công khai

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | public-consultation-response-workspace |
| Family | work |
| Dominant task | Đọc proposal hoặc docket, soạn phản hồi cho nhiều issue, gắn citation và preview chính xác nội dung sẽ công khai. |
| Search aliases | public-consultation-response-workspace; consultation response; docket issue response; public disclosure preview |
| Authority | Dominant-task topology, region graph, responsive transformation, interaction parity và state families. |

### Bất biến

- Đọc proposal hoặc docket, soạn phản hồi cho nhiều issue, gắn citation và preview chính xác nội dung sẽ công khai.
- Mỗi required region có một semantic owner; supporting context không lấy dominant task.
- DOM order, reading order và focus order giữ nguyên meaning qua wide, intermediate và compact.
- Grammar cung cấp product facts; Principles resolve exact geometry; archetype không sở hữu visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-PCR-01 | Đọc proposal hoặc docket, soạn phản hồi cho nhiều issue, gắn citation và preview chính xác nội dung sẽ công khai. | required positive evidence |
| AR-PCR-02 | Critical region relationship và owner separation đều có bằng chứng. | required relationship evidence |
| AR-PCR-03 | Wide relationship không còn hoạt động nhưng compact vẫn giữ task, state và recovery. | responsive transformation trigger |
| AR-PCR-04 | Error, permission, pending, success và stale/conflict đều có bounded recovery. | required state evidence |
| AR-PCR-90 | Reject split-reference form, generic document editor, regulatory-comment synthesis và generic multi-step application. | reject |
| AR-PCR-91 | Khác biệt chỉ là product noun, density, color, component, state skin hoặc card count. | duplicate-or-variation |

### Quy tắc chọn

Chỉ trả accept khi AR-PCR-01, AR-PCR-02 và AR-PCR-03 có bằng chứng, không có AR-PCR-90 hoặc AR-PCR-91, và mọi required region vẫn cần thiết ở cả ba topology. Trả needs-evidence khi owner, relation hoặc transformation chưa resolve.

## Region graph

~~~text
consultation-workspace
├─ docket-and-deadline
├─ issue-navigator
├─ source-proposal
├─ response-register
├─ cited-evidence-and-attachments
├─ public-disclosure-preview
└─ declaration-submit-receipt
~~~

Critical relationship: Issue response và public-disclosure preview có owner độc lập; submit yêu cầu đồng thời đủ issue coverage và disclosure safety.

### Nghĩa vụ vùng

| Region ID | Owner | Required relationship |
|---|---|---|
| consultation-workspace | Sở hữu boundary của dominant task và chứa mọi required region mà không tạo product semantics. | Chứa docket-and-deadline, issue-navigator, source-proposal, response-register, cited-evidence-and-attachments, public-disclosure-preview, declaration-submit-receipt và giữ owner độc lập của từng region. |
| docket-and-deadline | Sở hữu state và obligation của stage được đặt tên; không lấy authority của region lân cận. | Nhận context từ consultation-workspace và gates issue-navigator mà không gộp authority. |
| issue-navigator | Sở hữu membership, identity, status và current selection của collection hữu hạn này. | Nhận context từ docket-and-deadline và gates source-proposal mà không gộp authority. |
| source-proposal | Sở hữu source evidence, provenance, freshness và availability; không tự quyết định outcome. | Nhận context từ issue-navigator và gates response-register mà không gộp authority. |
| response-register | Sở hữu membership, identity, status và current selection của collection hữu hạn này. | Nhận context từ source-proposal và gates cited-evidence-and-attachments mà không gộp authority. |
| cited-evidence-and-attachments | Sở hữu source evidence, provenance, freshness và availability; không tự quyết định outcome. | Nhận context từ response-register và gates public-disclosure-preview mà không gộp authority. |
| public-disclosure-preview | Sở hữu derived interpretation hoặc consequence preview; không trở thành input authority thứ hai. | Nhận context từ cited-evidence-and-attachments và gates declaration-submit-receipt mà không gộp authority. |
| declaration-submit-receipt | Sở hữu bounded outcome, receipt hoặc recovery route sau khi mọi upstream gate đã pass. | Nhận verified state từ public-disclosure-preview và phát outcome hoặc recovery hữu hạn. |

## Responsive contract

### Wide

- Topology response: Keep the source proposal, active issue response, evidence, and public-disclosure preview simultaneously visible.
- Failure trigger: simultaneous regions làm hẹp readable measure, che state hoặc phá named relationship.
- Navigation replacement: chưa cần khi các vùng còn đồng hiện; sticky chỉ dành cho orientation context vừa viewport.
- Sticky boundary: tự yield ở short-height và không che focused control.
- Overflow owner: page own vertical overflow; chỉ intrinsic matrix mới own bounded horizontal overflow.

### Intermediate

- Topology response: Keep response and disclosure primary; move the source proposal to an anchored drawer that returns to the exact response.
- Failure trigger: supporting persistence cạnh tranh primary-task measure hoặc focus.
- Navigation replacement: named trigger mở supporting dialog; Escape hoặc Cancel đóng và focus trở đúng trigger.
- Sticky boundary: persistent context tự yield ở short-height; dialog body own bounded vertical overflow.
- Overflow owner: page giữ vertical overflow; supporting dialog chỉ own overflow bên trong boundary của nó.

### Compact

- Topology response: Stage one issue with its adjacent clause excerpt, citations and attachments, full public preview, declaration, then submission.
- Failure trigger: multi-pane relation không còn operable với body text 16px và target 44px.
- Navigation replacement: Previous, Next và stage selector thay pane adjacency; Back giữ selection, draft và recovery state.
- Sticky boundary: không fixed action bar; focused content luôn visible.
- Overflow owner: không page-level horizontal scroll; intrinsic matrix trở thành grouped records.

### Reflow

Thứ tự region graph là DOM order và reading order ở mọi width. CSS không reorder semantics. Text, localization, zoom và spacing growth làm region cao hơn hoặc trigger topology change; content không bị clip. State sống qua việc region đi vào hoặc ra supporting pane.

### Tương đương tương tác

Wide, intermediate và compact cung cấp cùng action, selection, pending guard, success, error, retry, stale/conflict recovery và outcome. Dynamic status được announce bằng polite live region mà không cướp focus. Modal giữ focus, hỗ trợ Escape hoặc Cancel và trả focus đúng trigger.

## Nghĩa vụ trạng thái

Domain state catalog giữ stable identifiers để EN/VI/context đồng bộ: docket loading/closed; issue unanswered/draft/complete; citation linked/broken; attachment scanning/failure; private data detected; preview stale; submit pending/rejected/accepted; receipt.

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
| domain states | Giữ đầy đủ state identifiers: docket loading/closed; issue unanswered/draft/complete; citation linked/broken; attachment scanning/failure; private data detected; preview stale; submit pending/rejected/accepted; receipt. | Mọi modal trả focus đúng trigger. | Giữ action và recovery parity. |

## Ranh giới

### Chấp nhận

Accept khi dominant task cần chính region graph này, critical relationship tạo topology riêng, và mọi responsive state giữ task cùng recovery parity.

### Từ chối

Reject split-reference form, generic document editor, regulatory-comment synthesis và generic multi-step application. Cũng reject duplicate-or-variation khi candidate chỉ đổi noun, density, component hoặc visual state.

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
| [European Commission — Better regulation](https://commission.europa.eu/law/law-making-process/better-regulation_en) | Hỗ trợ transparent public consultation and evidence contribution. | Không chứng minh product facts, geometry, breakpoint hoặc visual direction. |
| [US EPA — Commenting on EPA dockets](https://www.epa.gov/dockets/commenting-epa-dockets) | Hỗ trợ docket identity and public disclosure awareness. | Không chứng minh product facts, geometry, breakpoint hoặc visual direction. |
| [W3C WAI — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Hỗ trợ announcing preview, validation, and submission state without moving focus. | Không chứng minh product facts, geometry, breakpoint hoặc visual direction. |

## Output

~~~json
{
  "archetypeId": "public-consultation-response-workspace",
  "matchedSituationCodes": [
    "AR-PCR-01",
    "AR-PCR-02",
    "AR-PCR-03"
  ],
  "aliases": [
    "public-consultation-response-workspace",
    "consultation response",
    "docket issue response",
    "public disclosure preview"
  ],
  "dominantTask": "Read a proposal or docket, compose responses across multiple issues, bind citations, and preview exactly what will be public.",
  "regions": [
    "consultation-workspace",
    "docket-and-deadline",
    "issue-navigator",
    "source-proposal",
    "response-register",
    "cited-evidence-and-attachments",
    "public-disclosure-preview",
    "declaration-submit-receipt"
  ],
  "relationships": [
    "Issue responses and the public-disclosure preview are independent owners; submission requires both issue coverage and disclosure safety."
  ],
  "responsive": {
    "wide": "Keep the source proposal, active issue response, evidence, and public-disclosure preview simultaneously visible.",
    "intermediate": "Keep response and disclosure primary; move the source proposal to an anchored drawer that returns to the exact response.",
    "compact": "Stage one issue with its adjacent clause excerpt, citations and attachments, full public preview, declaration, then submission.",
    "reflow": "DOM and reading order remain stable; content grows without page-level horizontal scrolling.",
    "readingOrder": "consultation-workspace → docket-and-deadline → issue-navigator → source-proposal → response-register → cited-evidence-and-attachments → public-disclosure-preview → declaration-submit-receipt",
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
    "docket loading/closed; issue unanswered/draft/complete; citation linked/broken; attachment scanning/failure; private data detected; preview stale; submit pending/rejected/accepted; receipt"
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

