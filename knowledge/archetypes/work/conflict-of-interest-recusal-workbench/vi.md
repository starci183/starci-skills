# Workbench recusal do conflict of interest

## LOADS

None.

## Hồ sơ

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `conflict-of-interest-recusal-workbench` |
| Family | Work |
| Dominant task | Xác định participant có thể hành động trên matter cụ thể hay không, nối disclosed interest với affected party và thiết lập recusal, screening hoặc replacement ownership. |
| Search aliases | `recusal analysis`, `interest relationship map`, `independent owner replacement`, `screening arrangement` |
| Authority | Macro topology dùng chung, product-neutral. |

### Bất biến

- Dominant task luôn là: Xác định participant có thể hành động trên matter cụ thể hay không, nối disclosed interest với affected party và thiết lập recusal, screening hoặc replacement ownership.
- Required region graph luôn là `recusal-workbench → matter-and-party-scope → participant-roster → disclosure-interest-relationship-map ↔ selected-person-matter-analysis → actual-apparent-potential-classification → recusal-restriction-or-screening → replacement-independent-owner → acknowledgement-and-audit`.
- Mọi state và action gắn với một selected context cùng provenance của nó.
- DOM order, reading order và meaningful focus order luôn trùng nhau.
- Grammar sở hữu product semantics; Principles sở hữu geometry chưa resolve; Direction sở hữu visual character.
- Wide, intermediate và compact giữ nguyên action, state, keyboard access, overflow ownership và recovery.

## Nhận diện

### Mã tình huống

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-CR-01` | Dominant task đã nêu là outcome chính của người dùng. | Candidate evidence. |
| `AR-CR-02` | Mọi required region và named relationship đều hiện diện. | Required evidence. |
| `AR-CR-03` | Wide, intermediate và compact dùng đúng topology transformation đã khai báo. | Required evidence. |
| `AR-CR-04` | Compact giữ mọi action, state, keyboard path, focus return và recovery. | Required evidence. |
| `AR-CR-05` | Template must trace a disclosure to matter parties, classify the conflict with evidence, install recusal/screening, require a replacement owner and record acknowledgement without exposing restricted interests. | Required evidence. |
| `AR-CR-90` | access-conflict resolver | Từ chối. |
| `AR-CR-91` | case dossier | Từ chối. |
| `AR-CR-92` | declaration form | Từ chối. |
| `AR-CR-93` | approval routing | Từ chối. |

### Quy tắc chọn

Chỉ chọn `conflict-of-interest-recusal-workbench` khi `AR-CR-01` đến `AR-CR-05` đều có evidence và không có mã `AR-CR-9*`. Trả `needs-evidence` khi owner hoặc relationship bắt buộc chưa rõ. Trả `reject` khi có rejection code. Khác biệt chỉ ở noun, density, color, card count, component hoặc state là `duplicate-or-variation`.

## Sơ đồ vùng

```text
recusal-workbench
   `-- matter-and-party-scope
      `-- participant-roster
         `-- disclosure-interest-relationship-map
            `-- selected-person-matter-analysis
               `-- actual-apparent-potential-classification
                  `-- recusal-restriction-or-screening
                     `-- replacement-independent-owner
                        `-- acknowledgement-and-audit
```

Biểu thức relationship đã khai báo: `recusal-workbench → matter-and-party-scope → participant-roster → disclosure-interest-relationship-map ↔ selected-person-matter-analysis → actual-apparent-potential-classification → recusal-restriction-or-screening → replacement-independent-owner → acknowledgement-and-audit`.

### Nghĩa vụ vùng

| Vùng | Owner | Relationship |
|---|---|---|
| `recusal-workbench` | Sở hữu dominant task hoàn chỉnh, version context và recovery của mọi descendant. | Là root của graph bắt buộc; không được thay bằng generic container. |
| `matter-and-party-scope` | Sở hữu evidence, action, state và recovery của matter and party scope. | Theo sau `recusal-workbench` trong semantic order và dùng đúng selected context của vùng đó. |
| `participant-roster` | Sở hữu evidence, action, state và recovery của participant roster. | Theo sau `matter-and-party-scope` trong semantic order và dùng đúng selected context của vùng đó. |
| `disclosure-interest-relationship-map` | Sở hữu evidence, action, state và recovery của disclosure interest relationship map. | Đồng bộ hai chiều với `participant-roster` trong cùng selected context. |
| `selected-person-matter-analysis` | Sở hữu evidence, action, state và recovery của selected person matter analysis. | Đồng bộ hai chiều với `disclosure-interest-relationship-map` trong cùng selected context. |
| `actual-apparent-potential-classification` | Sở hữu evidence, action, state và recovery của actual apparent potential classification. | Theo sau `selected-person-matter-analysis` trong semantic order và dùng đúng selected context của vùng đó. |
| `recusal-restriction-or-screening` | Sở hữu evidence, action, state và recovery của recusal restriction or screening. | Theo sau `actual-apparent-potential-classification` trong semantic order và dùng đúng selected context của vùng đó. |
| `replacement-independent-owner` | Sở hữu evidence, action, state và recovery của replacement independent owner. | Theo sau `recusal-restriction-or-screening` trong semantic order và dùng đúng selected context của vùng đó. |
| `acknowledgement-and-audit` | Sở hữu evidence, action, state và recovery của acknowledgement and audit. | Theo sau `replacement-independent-owner` trong semantic order và dùng đúng selected context của vùng đó. |

## Hợp đồng responsive

### Wide

- **Failure trigger:** Wide kết thúc khi các vùng đồng thời không còn giữ label dễ đọc, association chính xác, action nhìn thấy và focus không bị che.
- **Topology response:** Giữ đồng thời đúng các owner được contract nêu: Matter/participants, relationship evidence, conflict analysis and recusal/replacement arrangement remain visible.
- **Navigation replacement:** Không có khi mọi required owner vẫn dùng đồng thời được.
- **Sticky boundary:** Chỉ outcome hoặc action hiện tại được persist; nó reserve space và yield khi viewport thấp.
- **Overflow owner:** Chỉ `disclosure-interest-relationship-map` được sở hữu bounded horizontal overflow; nội dung thường không tạo page-level horizontal scroll.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi persistent region ít ưu tiên nhất làm hỏng dominant cross-region relationship.
- **Topology response:** Chuyển đúng theo contract: Participant roster becomes a drawer; selected analysis remains primary and mitigation/replacement uses a side sheet.
- **Navigation replacement:** Named synchronized drawer, disclosure hoặc pane thay mỗi persistent region bị dời và trigger hiển thị state hiện tại.
- **Sticky boundary:** Persistent action chỉ tồn tại khi exact target nhìn thấy và trở lại in-flow khi viewport thấp.
- **Overflow owner:** `disclosure-interest-relationship-map` giữ bounded overflow axis duy nhất và có text/list equivalent.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai task owner đồng thời không thể giữ evidence dễ đọc và control 44-by-44 CSS pixel.
- **Topology response:** Tái cấu trúc theo primary sequence: Participant → disclosures/relationships → classification → recusal/screening plan → replacement owner → acknowledgement; sticky status yields to focused controls.
- **Navigation replacement:** Dùng một primary-pane sequence với Previous và Next rõ ràng, khôi phục selection, query, state và scroll context.
- **Sticky boundary:** Current action reserve content space, không che focus và trở lại normal flow khi viewport thấp.
- **Overflow owner:** Text hoặc relation ledger là primary; `disclosure-interest-relationship-map` chỉ là optional bounded region.

### Reflow

- Semantic và DOM order là `recusal-workbench → matter-and-party-scope → participant-roster → disclosure-interest-relationship-map → selected-person-matter-analysis → actual-apparent-potential-classification → recusal-restriction-or-screening → replacement-independent-owner → acknowledgement-and-audit`.
- Text zoom, translation dài và control phóng to kích hoạt cùng named topology change.
- CSS không reorder visual content lệch khỏi keyboard hoặc assistive-technology order.
- Label và identifier dài được wrap; detail ẩn có accessible reveal rõ ràng.
- Nội dung thường không tạo page-level horizontal scroll.

### Ngang bằng tương tác

- Mọi selection, edit, action, explanation, retry và recovery ở wide vẫn reachable tại intermediate và compact.
- Topology change giữ selected entity, version, filter, pending state, validation result và recovery point.
- Dynamic update dùng một contextual status message mà không di chuyển focus.
- Modal nhận và giữ focus, hỗ trợ Escape hoặc Cancel, rồi trả focus về đúng trigger.
- Drag, drawing, fader, spatial hoặc point movement có parity bằng button, numeric hoặc list.
- Color, position, geometry và motion luôn có text hoặc structural equivalent.

## Nghĩa vụ trạng thái

| State | Vùng sở hữu | Nghĩa vụ |
|---|---|---|
| Khởi đầu / loading | `matter-and-party-scope` | Xác định scope đang chờ và giữ semantic position. |
| Ready | `participant-roster` | Hiển thị dominant task hoàn chỉnh và version hiện tại. |
| Empty / không áp dụng | `disclosure-interest-relationship-map` | Phân biệt absence có nghĩa với evidence unavailable. |
| Lỗi / retry | `selected-person-matter-analysis` | Giữ context hợp lệ và cung cấp retry cục bộ mà không reset selection. |
| Permission / unavailable | `replacement-independent-owner` | Không suy diễn evidence bị hạn chế là không tồn tại; cung cấp alternate route an toàn. |
| Pending | `acknowledgement-and-audit` | Ngăn action trùng và announce tiến độ mà không di chuyển focus. |
| Success | `acknowledgement-and-audit` | Hiển thị outcome, provenance và action hợp lệ kế tiếp. |
| Stale / conflict | `matter-and-party-scope` | Giữ giá trị an toàn cuối cùng và yêu cầu reconciliation rõ ràng. |
| Chuyển focus | `acknowledgement-and-audit` | Chỉ đưa focus tới error summary bắt buộc hoặc modal vừa mở, rồi trả về đúng trigger. |
| Trình bày responsive | `recusal-workbench` | Giữ selected entity, query, state và recovery khi topology đổi. |
| matter loading | `matter-and-party-scope` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| disclosure missing/verified | `participant-roster` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| relationship direct/indirect/uncertain | `disclosure-interest-relationship-map` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| conflict none/potential/apparent/actual | `selected-person-matter-analysis` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| recusal proposed/accepted | `actual-apparent-potential-classification` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| screen incomplete | `recusal-restriction-or-screening` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| replacement unavailable | `replacement-independent-owner` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |
| acknowledgement pending and audit locked. | `acknowledgement-and-audit` | Hiển thị state đặc thù này cùng cause, consequence và recovery hợp lệ. |

## Ranh giới

### Chấp nhận

- Chỉ accept khi dominant task chuyển required evidence thành outcome đã khai báo.
- Chỉ accept khi mỗi required region có owner độc lập và named relationship vẫn explicit.
- Chỉ accept khi template must trace a disclosure to matter parties, classify the conflict with evidence, install recusal/screening, require a replacement owner and record acknowledgement without exposing restricted interests.

### Từ chối

- Từ chối access-conflict resolver; đây là evidence `AR-CR-90` và phải route sang archetype khác.
- Từ chối case dossier; đây là evidence `AR-CR-91` và phải route sang archetype khác.
- Từ chối declaration form; đây là evidence `AR-CR-92` và phải route sang archetype khác.
- Từ chối approval routing; đây là evidence `AR-CR-93` và phải route sang archetype khác.
- Từ chối candidate chỉ thỏa task bằng cách đổi product noun hoặc visual treatment.

### Phán quyết ranh giới

Trả `accept` chỉ khi dominant task, complete required graph, transformation contract, state/recovery parity và `AR-CR-05` đều giữ. Trả `reject` cho rejection code. Trả `needs-evidence` khi owner hoặc relationship chưa resolve. Báo `duplicate-or-variation` cho khác biệt chỉ ở noun, density, color, card count, component hoặc state.

## Bàn giao

- **Grammar handoff:** Bind product-specific owner, label, permission, truthful state meaning và permitted action vào declared regions.
- **Principles handoff:** Resolve exact grid, measure, gap, alignment, sticky offset, bounded overflow realization và relationship-driven transition points.
- Hai handoff không được xóa required region, thay dominant task hoặc làm yếu keyboard, focus, responsive hay recovery parity.

## Bằng chứng nghiên cứu không ràng buộc

### Ranh giới bằng chứng

Research bên ngoài là advisory evidence, không phải product truth. Nó hỗ trợ synthesis của task relationship, responsive transformation, interaction và accessibility obligation. Nó không đặt tên StarCi owner, chọn exact geometry, tạo product fact hoặc cấp quyền copy source interface.

### Nguồn

| Nguồn | Hỗ trợ điều gì | Không chứng minh điều gì |
|---|---|---|
| [OECD — Conflict of Interest Guidelines](https://legalinstruments.oecd.org/public/doc/130/body-text.en.html) | Hỗ trợ private-interest mapping and impartial public duty. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |
| [U.S. OGE — Screening Arrangements](https://www.oge.gov/Web/OGE.nsf/0/A633CAF20D2571F5852585BA005BED3D/%24FILE/DO-04-012.pdf) | Hỗ trợ recusal, screening, notification, and independent handling. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |
| [W3C WAI — Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Hỗ trợ meaningful focus through restricted disclosures. | Không chọn archetype này, không định nghĩa product truth và không cấp quyền copy geometry. |

Source set gồm tài liệu official hiện hành từ ít nhất ba tổ chức độc lập và có W3C accessibility evidence.

## Đầu ra

```json
{
  "archetypeId": "conflict-of-interest-recusal-workbench",
  "situationCodes": [
    "<matched AR-CR-* codes>"
  ],
  "searchAliases": [
    "recusal analysis",
    "interest relationship map",
    "independent owner replacement",
    "screening arrangement"
  ],
  "dominantTask": "Determine whether a participant may act on a specific matter, connect disclosed interests to affected parties, and install recusal, screening or replacement ownership.",
  "regions": [
    "recusal-workbench",
    "matter-and-party-scope",
    "participant-roster",
    "disclosure-interest-relationship-map",
    "selected-person-matter-analysis",
    "actual-apparent-potential-classification",
    "recusal-restriction-or-screening",
    "replacement-independent-owner",
    "acknowledgement-and-audit"
  ],
  "regionRelationships": [
    "recusal-workbench → matter-and-party-scope → participant-roster → disclosure-interest-relationship-map ↔ selected-person-matter-analysis → actual-apparent-potential-classification → recusal-restriction-or-screening → replacement-independent-owner → acknowledgement-and-audit"
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<named synchronized panes or drawers>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "recusal-workbench → matter-and-party-scope → participant-roster → disclosure-interest-relationship-map → selected-person-matter-analysis → actual-apparent-potential-classification → recusal-restriction-or-screening → replacement-independent-owner → acknowledgement-and-audit",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "disclosure-interest-relationship-map",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": [
    "matter loading",
    "disclosure missing/verified",
    "relationship direct/indirect/uncertain",
    "conflict none/potential/apparent/actual",
    "recusal proposed/accepted",
    "screen incomplete",
    "replacement unavailable",
    "acknowledgement pending and audit locked."
  ],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": [
    "<product meaning and semantic owners>"
  ],
  "principlesHandoff": [
    "<unresolved geometry only>"
  ],
  "confidence": "<high | medium | low>",
  "evidence": [
    "<business or current-source facts>",
    "<official task research>",
    "<accessibility research>"
  ]
}
```

