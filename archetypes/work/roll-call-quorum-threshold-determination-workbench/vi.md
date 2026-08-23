# Roll Call Quorum Threshold Determination Workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `roll-call-quorum-threshold-determination-workbench` |
| Family | Work |
| Dominant task | Xác định một kiến nghị có được thông qua theo quy tắc thủ tục có phiên bản, tập thành viên đủ điều kiện và mẫu số túc số tại thời điểm quyết định, cùng sổ điểm danh cấp thành viên có thể kiểm toán. |
| Search aliases | `roll call determination`, `quorum denominator`, `motion threshold audit`, `certified vote journal` |
| Authority | Bản ghi này quy định topology vĩ mô dùng chung, trung lập với sản phẩm. |

### Invariants

- Nhiệm vụ trội không đổi: Xác định một kiến nghị có được thông qua theo quy tắc thủ tục có phiên bản, tập thành viên đủ điều kiện và mẫu số túc số tại thời điểm quyết định, cùng sổ điểm danh cấp thành viên có thể kiểm toán.
- Đồ thị vùng bắt buộc không đổi: `roll-call-determination → body-session-motion-rule-and-time-version → eligible-membership-set → vacancy-disqualification-recusal-and-pair-adjustments → dynamic-quorum-and-decision-denominators ↔ member-by-member-roll-call-ledger → present-voting-abstaining-absent-and-challenged-tallies → majority-supermajority-tie-and-casting-vote-rule → provisional-result → challenge-correction-or-recount → certified-result-and-journal-receipt`.
- Tập đủ điều kiện có phiên bản dẫn xuất các mẫu số trong khi phản hồi thành viên bất biến dẫn xuất các tử số; chúng chỉ gặp nhau tại ngưỡng của kiến nghị.
- DOM order, reading order và meaningful focus order luôn giống nhau.
- Grammar sở hữu semantic sản phẩm; Principles sở hữu geometry chưa giải; Direction sở hữu visual character.
- Wide, intermediate và compact giữ action, state, keyboard access, overflow ownership và recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-RQ-01` | Nhiệm vụ trội là kết quả chính của trang. | Bằng chứng ứng viên. |
| `AR-RQ-02` | Mọi vùng bắt buộc và quan hệ được đặt tên đều hiện diện. | Bằng chứng bắt buộc. |
| `AR-RQ-03` | Wide, intermediate và compact dùng đúng chuyển đổi topology đã khai báo. | Bằng chứng bắt buộc. |
| `AR-RQ-04` | Compact giữ mọi action, state, đường bàn phím và recovery. | Bằng chứng bắt buộc. |
| `AR-RQ-05` | Mẫu tương tác chứng minh acceptance focus của prompt. | Bằng chứng bắt buộc. |
| `AR-RQ-90` | survey-response-analysis-overview | Loại. |
| `AR-RQ-91` | calculation-estimate-flow | Loại. |
| `AR-RQ-92` | review-submit-ledger | Loại. |
| `AR-RQ-93` | generic vote counter | Loại. |

### Selection rule

Chọn `roll-call-quorum-threshold-determination-workbench` chỉ khi các mã 01–05 được chứng minh và không có mã 9*. Trả `needs-evidence` khi chưa rõ owner hoặc quan hệ; trả `reject` khi có bằng chứng loại; khác biệt chỉ ở noun, density, color, card count, component hoặc state là `duplicate-or-variation`.

## Region graph

```text
roll-call-determination
   `-- body-session-motion-rule-and-time-version
      `-- eligible-membership-set
         `-- vacancy-disqualification-recusal-and-pair-adjustments
            `-- dynamic-quorum-and-decision-denominators
               `-- member-by-member-roll-call-ledger
                  `-- present-voting-abstaining-absent-and-challenged-tallies
                     `-- majority-supermajority-tie-and-casting-vote-rule
                        `-- provisional-result
                           `-- challenge-correction-or-recount
                              `-- certified-result-and-journal-receipt
```

Biểu thức quan hệ đã khai báo: `roll-call-determination → body-session-motion-rule-and-time-version → eligible-membership-set → vacancy-disqualification-recusal-and-pair-adjustments → dynamic-quorum-and-decision-denominators ↔ member-by-member-roll-call-ledger → present-voting-abstaining-absent-and-challenged-tallies → majority-supermajority-tie-and-casting-vote-rule → provisional-result → challenge-correction-or-recount → certified-result-and-journal-receipt`.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `roll-call-determination` | Sở hữu nhiệm vụ trội, context phiên bản và recovery của mọi hậu duệ. | Là gốc của đồ thị và không thể bị thay bằng container chung. |
| `body-session-motion-rule-and-time-version` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |
| `eligible-membership-set` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |
| `vacancy-disqualification-recusal-and-pair-adjustments` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |
| `dynamic-quorum-and-decision-denominators` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |
| `member-by-member-roll-call-ledger` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |
| `present-voting-abstaining-absent-and-challenged-tallies` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |
| `majority-supermajority-tie-and-casting-vote-rule` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |
| `provisional-result` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |
| `challenge-correction-or-recount` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |
| `certified-result-and-journal-receipt` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi các vùng đồng thời không còn giữ được nhãn đọc được, liên kết rõ, action thấy được và focus không bị che.
- **Topology response:** Motion and rule, membership adjustments, denominator derivation, roll-call ledger, tallies, and threshold result remain simultaneously visible.
- **Navigation replacement:** Không thay thế khi mọi owner bắt buộc còn dùng đồng thời.
- **Sticky boundary:** Chỉ outcome hoặc action hiện tại được sticky; nó giữ chỗ và trở về in-flow khi chiều cao ngắn.
- **Overflow owner:** `member-by-member-roll-call-ledger` Chỉ vùng đã khai báo sở hữu overflow có giới hạn; nội dung thường không tạo cuộn ngang toàn trang.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi vùng persistent ưu tiên thấp nhất phá quan hệ trội.
- **Topology response:** The threshold, unresolved member statuses, and challenged responses remain primary; membership evidence, rule text, and prior counts move to synchronized disclosures.
- **Navigation replacement:** Disclosure hoặc drawer đồng bộ có tên thay vùng bị dời và trigger nêu trạng thái hiện tại.
- **Sticky boundary:** Chỉ outcome hoặc action hiện tại được sticky; nó giữ chỗ và trở về in-flow khi chiều cao ngắn.
- **Overflow owner:** `member-by-member-roll-call-ledger` Chỉ vùng đã khai báo sở hữu overflow có giới hạn; nội dung thường không tạo cuộn ngang toàn trang.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai owner đồng thời không thể giữ bằng chứng đọc được và control 44×44 CSS px.
- **Topology response:** Motion and rule → eligible set → denominator adjustments → one member response → persistent tallies → threshold or tie rule → challenge or recount → certification becomes a member queue.
- **Navigation replacement:** Một chuỗi primary-pane với Previous và Next giữ selection, query, state và scroll context.
- **Sticky boundary:** Chỉ outcome hoặc action hiện tại được sticky; nó giữ chỗ và trở về in-flow khi chiều cao ngắn.
- **Overflow owner:** `member-by-member-roll-call-ledger` Chỉ vùng đã khai báo sở hữu overflow có giới hạn; nội dung thường không tạo cuộn ngang toàn trang.

### Reflow

- Semantic order và DOM order là `roll-call-determination → body-session-motion-rule-and-time-version → eligible-membership-set → vacancy-disqualification-recusal-and-pair-adjustments → dynamic-quorum-and-decision-denominators → member-by-member-roll-call-ledger → present-voting-abstaining-absent-and-challenged-tallies → majority-supermajority-tie-and-casting-vote-rule → provisional-result → challenge-correction-or-recount → certified-result-and-journal-receipt`.
- Text zoom, bản dịch dài và control phóng to kích hoạt cùng các topology change đã đặt tên.
- CSS không reorder nội dung thị giác khỏi keyboard order hoặc assistive-technology order.
- Label dài được wrap và detail ẩn có reveal rõ ràng, accessible.

### Interaction parity

- Mọi selection, edit, action, explanation, retry và recovery ở wide vẫn tới được tại intermediate và compact.
- Topology change giữ entity đã chọn, phiên bản, pending state, validation result và recovery point.
- Dynamic update dùng contextual status message mà không dời focus.
- Color, position, geometry và motion có tương đương bằng text hoặc cấu trúc.

## State obligations

| State | Vùng sở hữu | Nghĩa vụ |
|---|---|---|
| Initial / loading | `body-session-motion-rule-and-time-version` | Xác định scope đang chờ và giữ semantic position. |
| Ready | `eligible-membership-set` | Bộc lộ đầy đủ nhiệm vụ trội và phiên bản hiện tại. |
| Empty / not applicable | `vacancy-disqualification-recusal-and-pair-adjustments` | Phân biệt vắng mặt có ý nghĩa với bằng chứng không khả dụng. |
| Error / retry | `dynamic-quorum-and-decision-denominators` | Giữ context hợp lệ và cho retry cục bộ không reset selection. |
| Permission / unavailable | `member-by-member-roll-call-ledger` | Không ngụ ý bằng chứng bị hạn chế là không tồn tại; cung cấp route an toàn. |
| Pending | `present-voting-abstaining-absent-and-challenged-tallies` | Ngăn action lặp và announce tiến độ mà không dời focus. |
| Success | `majority-supermajority-tie-and-casting-vote-rule` | Bộc lộ outcome, provenance và action hợp lệ tiếp theo. |
| Stale / conflict | `provisional-result` | Giữ giá trị an toàn cuối và yêu cầu reconciliation rõ. |
| Focus transition | `challenge-correction-or-recount` | Chỉ dời focus tới error summary bắt buộc; sau recovery trả đúng trigger. |
| Responsive presentation | `certified-result-and-journal-receipt` | Giữ entity, query, state và recovery khi topology đổi. |
| rule current/superseded | `body-session-motion-rule-and-time-version` | Bộc lộ cause, consequence và recovery hợp lệ mà không ghi đè provenance. |
| member eligible/ineligible/recused/vacant | `eligible-membership-set` | Bộc lộ cause, consequence và recovery hợp lệ mà không ghi đè provenance. |
| attendance unknown/present/absent | `vacancy-disqualification-recusal-and-pair-adjustments` | Bộc lộ cause, consequence và recovery hợp lệ mà không ghi đè provenance. |
| response pending/aye/no/abstain/paired/challenged | `dynamic-quorum-and-decision-denominators` | Bộc lộ cause, consequence và recovery hợp lệ mà không ghi đè provenance. |
| quorum unmet/met/lost | `member-by-member-roll-call-ledger` | Bộc lộ cause, consequence và recovery hợp lệ mà không ghi đè provenance. |
| threshold unresolved/met/not-met | `present-voting-abstaining-absent-and-challenged-tallies` | Bộc lộ cause, consequence và recovery hợp lệ mà không ghi đè provenance. |
| tie absent/present/resolved | `majority-supermajority-tie-and-casting-vote-rule` | Bộc lộ cause, consequence và recovery hợp lệ mà không ghi đè provenance. |
| count open/closed/recounting | `provisional-result` | Bộc lộ cause, consequence và recovery hợp lệ mà không ghi đè provenance. |
| result provisional/challenged/corrected/certified | `challenge-correction-or-recount` | Bộc lộ cause, consequence và recovery hợp lệ mà không ghi đè provenance. |
| journal pending/published | `certified-result-and-journal-receipt` | Bộc lộ cause, consequence và recovery hợp lệ mà không ghi đè provenance. |

## Boundaries

### Accept

- Chỉ accept khi nhiệm vụ trội biến đổi bằng chứng bắt buộc thành outcome khai báo.
- Chỉ accept khi mỗi vùng có owner độc lập và quan hệ vẫn rõ.
- Có quy tắc kiến nghị có phiên bản, tập thành viên và mẫu số được dẫn xuất động, điểm danh cấp thành viên bất biến, ngưỡng túc số và quyết định, ngữ nghĩa kiêng phiếu và vắng mặt, thẩm quyền xử lý hòa, phản đối hoặc kiểm lại và biên nhận nhật ký được chứng nhận.

### Reject

- Loại `survey-response-analysis-overview`; đây là bằng chứng `AR-RQ-90` và phải route sang archetype liền kề.
- Loại `calculation-estimate-flow`; đây là bằng chứng `AR-RQ-91` và phải route sang archetype liền kề.
- Loại `review-submit-ledger`; đây là bằng chứng `AR-RQ-92` và phải route sang archetype liền kề.
- Loại `generic vote counter`; đây là bằng chứng `AR-RQ-93` và phải route sang archetype liền kề.
- Loại mọi candidate chỉ đạt task bằng cách đổi product noun hoặc treatment thị giác.

### Boundary verdict

Trả `accept` chỉ khi nhiệm vụ trội, đồ thị đầy đủ, hợp đồng chuyển đổi, state và recovery parity cùng acceptance focus đều đúng. Trả `reject` với mọi mã loại. Trả `needs-evidence` khi owner hoặc quan hệ chưa được giải quyết.

## Handoff

- **Grammar handoff:** Gắn owner, label, permission, nghĩa state trung thực và action được phép của sản phẩm vào các vùng đã khai báo.
- **Principles handoff:** Giải exact grid, measure, gap, alignment, sticky offset, bounded overflow và transition point do quan hệ quyết định.
- Không handoff nào được xóa vùng bắt buộc, thay nhiệm vụ trội hoặc làm yếu keyboard, focus, responsive hay recovery parity.

## Non-binding research evidence

### Evidence boundary

Research bên ngoài là bằng chứng tư vấn, không phải product truth. Nó hỗ trợ tổng hợp quan hệ task, responsive transformation, interaction và accessibility; nó không đặt tên owner StarCi, chọn exact geometry, tạo product fact hoặc cấp quyền copy giao diện nguồn.

### Sources

| Source | What it supports | What it does not prove |
|---|---|---|
| [U.S. House Committee on Rules — Rules and resources](https://rules.house.gov/resources) | Versioned procedural rule and precedent sources. | A fictional body's rule or interface. |
| [U.S. Senate — Roll call votes](https://www.senate.gov/legislative/votes_new.htm) | Member-level roll-call results, tallies, outcomes, and vote records. | Universal quorum semantics or product geometry. |
| [Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Dense roster status and row-action behavior. | Procedural authority or copied layout. |
| [W3C WAI — Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Non-disruptive announcement of tally, challenge, and certification changes. | Vote truth or exact topology. |

Bộ nguồn gồm tài liệu chính thức hiện hành từ ít nhất ba tổ chức độc lập và có bằng chứng accessibility của W3C.

## Output

```json
{
  "archetypeId": "roll-call-quorum-threshold-determination-workbench",
  "situationCodes": ["<matched AR-RQ-* codes>"],
  "searchAliases": ["roll call determination","quorum denominator","motion threshold audit","certified vote journal"],
  "dominantTask": "Determine whether one motion is adopted from a versioned procedural rule, the eligible membership and quorum denominator at decision time, and an auditable member-level roll-call ledger.",
  "regions": ["roll-call-determination","body-session-motion-rule-and-time-version","eligible-membership-set","vacancy-disqualification-recusal-and-pair-adjustments","dynamic-quorum-and-decision-denominators","member-by-member-roll-call-ledger","present-voting-abstaining-absent-and-challenged-tallies","majority-supermajority-tie-and-casting-vote-rule","provisional-result","challenge-correction-or-recount","certified-result-and-journal-receipt"],
  "regionRelationships": ["roll-call-determination → body-session-motion-rule-and-time-version → eligible-membership-set → vacancy-disqualification-recusal-and-pair-adjustments → dynamic-quorum-and-decision-denominators ↔ member-by-member-roll-call-ledger → present-voting-abstaining-absent-and-challenged-tallies → majority-supermajority-tie-and-casting-vote-rule → provisional-result → challenge-correction-or-recount → certified-result-and-journal-receipt"],
  "responsive": {
    "wide": "<simultaneous required regions>",
    "intermediate": "<synchronized disclosures for displaced regions>",
    "compact": "<primary-pane trace sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "roll-call-determination → body-session-motion-rule-and-time-version → eligible-membership-set → vacancy-disqualification-recusal-and-pair-adjustments → dynamic-quorum-and-decision-denominators → member-by-member-roll-call-ledger → present-voting-abstaining-absent-and-challenged-tallies → majority-supermajority-tie-and-casting-vote-rule → provisional-result → challenge-correction-or-recount → certified-result-and-journal-receipt",
    "navigationReplacement": "<none | synchronized disclosure | primary-pane sequence>",
    "stickyBehavior": "<reserved-space outcome and short-height yield>",
    "overflowOwner": "member-by-member-roll-call-ledger",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["rule current/superseded","member eligible/ineligible/recused/vacant","attendance unknown/present/absent","response pending/aye/no/abstain/paired/challenged","quorum unmet/met/lost","threshold unresolved/met/not-met","tie absent/present/resolved","count open/closed/recounting","result provisional/challenged/corrected/certified","journal pending/published"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

