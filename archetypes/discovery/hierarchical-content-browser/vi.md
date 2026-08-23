# Hierarchical content browser

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `hierarchical-content-browser` |
| Family | Discovery |
| Dominant task | Đi qua taxonomy hoặc folder tree và inspect content index thuộc node hiện tại. |
| Search aliases | `taxonomy browser, folder browser, content tree, hierarchical index` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- Archetype này chỉ quyết định dominant task, required region, quan hệ vùng, responsive transformation và interaction parity.
- Grammar sở hữu semantic và product owner; Principles sở hữu exact geometry cùng breakpoint; Direction sở hữu visual character.
- Current source và research là evidence, không phải quyền copy layout hoặc tạo product fact.
- Region ID, situation code và shared state giữ nguyên qua wide, intermediate và compact.

## Recognition

### Situation codes

| Code | Situation | Verdict or obligation |
|---|---|---|
| `AR-HCB-01` | Đi qua taxonomy hoặc folder tree và inspect content index thuộc node hiện tại. | Candidate khi được chứng minh. |
| `AR-HCB-02` | Mọi region trong `content-browser → hierarchy-navigation → current-path → node-content-index → optional-context-preview` đều bắt buộc và có owner riêng. | Bắt buộc để chọn. |
| `AR-HCB-03` | Selection, query, anchor, progress hoặc path là shared state giữa các region liên quan. | Giữ một state identity. |
| `AR-HCB-04` | Một quan hệ đồng hiện được đặt tên thất bại trước khi content hoặc control mất khả dụng. | Áp dụng responsive contract. |
| `AR-HCB-05` | Compact replacement giữ action, state, recovery và focus context. | Bắt buộc cho parity. |
| `AR-HCB-90` | Global application navigation nằm ngoài browser cục bộ này. | Reject. |
| `AR-HCB-91` | Peer discovery phẳng cần catalog. | Reject. |
| `AR-HCB-92` | Quan hệ many-to-many cần graph. | Reject. |

### Selection rule

Chọn `hierarchical-content-browser` chỉ khi AR-HCB-01, AR-HCB-02, AR-HCB-03 được chứng minh và không có AR-HCB-90, AR-HCB-91, AR-HCB-92. Áp dụng responsive contract khi AR-HCB-04 xảy ra. Trả `needs-evidence` khi không thể chứng minh AR-HCB-05.

## Region graph

```text
content-browser
├─ hierarchy-navigation
├─ current-path
├─ node-content-index
└─ optional-context-preview
```

Quan hệ chuẩn: `content-browser → hierarchy-navigation → current-path → node-content-index → optional-context-preview`.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `content-browser` | Sở hữu taxonomy navigation và peer content index của current node; thiết lập expanded branch, current path, selected node, content selection và return anchor cho mọi child mà không hấp thụ trách nhiệm của child. |
| `hierarchy-navigation` | sở hữu expand/collapse và node selection trong taxonomy; nhận expanded branch, current path, selected node, content selection và return anchor từ `content-browser` và publish cùng identity tới `current-path`. |
| `current-path` | sở hữu ancestor path visible và compact Back route; nhận expanded branch, current path, selected node, content selection và return anchor từ `hierarchy-navigation` và publish cùng identity tới `node-content-index`. |
| `node-content-index` | sở hữu peer content thuộc current node; nhận expanded branch, current path, selected node, content selection và return anchor từ `current-path` và publish cùng identity tới `optional-context-preview`. |
| `optional-context-preview` | sở hữu optional context cho selected item mà không thành hierarchy level thứ ba bắt buộc; nhận expanded branch, current path, selected node, content selection và return anchor từ `node-content-index` và đóng dominant-task loop. |

## Responsive contract

### Wide

- **Failure trigger:** Mọi required region còn measure khả dụng và sự đồng hiện vẫn giúp dominant task.
- **Topology response:** Giữ hierarchy navigation cạnh index của node hiện tại; preview là tùy chọn và không bao giờ là cấp semantic thứ ba bắt buộc.
- **Navigation replacement:** Không thay thế; hierarchy navigation và current node index đồng hiện.
- **Sticky boundary:** Hierarchy chỉ persist khi reserve space và không che index focus.
- **Overflow owner:** Page flow own index; tree lớn có thể own bounded internal vertical overflow.

### Intermediate

- **Failure trigger:** Supporting region ưu tiên thấp nhất không còn đồng hiện được mà không làm hỏng measure, path hoặc control.
- **Topology response:** Chuyển hierarchy vào rail có thể thu gọn hoặc drawer trong khi current path vẫn nhìn thấy.
- **Navigation replacement:** Đưa hierarchy vào collapsible rail/drawer và luôn giữ current path visible.
- **Sticky boundary:** Drawer trả focus về path trigger.
- **Overflow owner:** Page flow own index; drawer chỉ own internal tree.

### Compact

- **Failure trigger:** Hai hay nhiều primary/supporting region không thể đồng hiện với reading, focus và touch target khả dụng.
- **Topology response:** Drill down từng cấp với breadcrumb hoặc Back, sau đó là index của node hiện tại.
- **Navigation replacement:** Dùng drill-down từng cấp bằng breadcrumb/Back, sau đó là current node index.
- **Sticky boundary:** Không ép desktop tree vào permanent overlay.
- **Overflow owner:** Active level và index share page flow; inactive level không tạo scroll.

### Reflow

- DOM order và reading order theo region graph; CSS không reorder semantic.
- Resize không reset query, selection, anchor, progress, path hoặc recovery state.
- Text zoom, bản dịch dài, missing media và user content không làm mất label, relationship hoặc recovery route.
- Page không tạo horizontal scroll; bounded exception thuộc đúng overflow owner đã khai báo.

### Interaction parity

- Mọi wide action, state, recovery route và keyboard path tồn tại ở intermediate và compact.
- Temporary surface hỗ trợ Escape hoặc cancel, giữ modal focus và trả focus đúng trigger.
- Dynamic status được announce không cướp focus; visual state không chỉ dựa vào color.
- Pointer, hover, gesture và motion luôn có keyboard hoặc static alternative.

## State obligations

| State family | Region | Obligation | Responsive presentation |
|---|---|---|---|
| Initial/loading | `hierarchy-navigation` | Tải node expansion và current index đang tải mà không thay expanded branch, current path, selected node, content selection và return anchor đã commit gần nhất. | Giữ context an toàn gần nhất ở mọi band. |
| Ready | `node-content-index` | Expose expanded path, current node và peer index dưới dạng một shared state đã commit. | Biểu diễn cùng identity ở mọi topology. |
| Empty/not-applicable | `current-path` | Biểu diễn current node rỗng kèm sibling/parent recovery; phân biệt empty với not-applicable và giữ recovery route. | Đặt explanation và recovery trong primary sequence. |
| Error/retry | `node-content-index` | Khi branch missing hoặc node load lỗi nhưng ancestor path được giữ, nêu failing scope và giữ context không bị ảnh hưởng. | Giữ retry reachable bên ngoài surface đã collapse. |
| Permission/unavailable | `node-content-index` | Biểu diễn branch bị giới hạn permission mà không suy diễn rỗng; không suy diễn dữ liệu unavailable là absent. | Giữ path và alternate route visible. |
| Pending | `optional-context-preview` | Trong khi expand, deep-link resolution hoặc preview load đang chờ, disable duplicate action và announce progress mà không di chuyển focus. | Giữ action label, target và recovery. |
| Success | `optional-context-preview` | Sau khi selected node/index phục hồi tại cùng path, xác nhận outcome mà không reset selection hoặc auto-scroll. | Announce outcome tại chỗ. |
| Stale/conflict | `node-content-index` | Khi rename/move bên ngoài làm path stale, giữ last safe view và cung cấp refresh hoặc reconciliation. | Topology change không tự resolve staleness. |
| Focus transition | `hierarchy-navigation` | đóng drawer và compact Back trả expansion/selection/trigger focus. | Inline và modal presentation giữ cùng action path. |
| Responsive presentation | `content-browser` | Resize giữ expanded branch, current path, selected node, content selection và return anchor, recovery và action availability. | Không state hoặc action nào biến mất. |

## Boundaries

### Accept

- Dominant task khớp: Đi qua taxonomy hoặc folder tree và inspect content index thuộc node hiện tại.
- Mọi required region và quan hệ `content-browser → hierarchy-navigation → current-path → node-content-index → optional-context-preview` đều có evidence.
- Compact replacement giữ selection, state, action, recovery và focus context.

### Reject

- Global application navigation nằm ngoài browser cục bộ này.
- Peer discovery phẳng cần catalog.
- Quan hệ many-to-many cần graph.
- Ba cấp độc lập cần three-pane explorer.
- Reject khi khác archetype hiện có chỉ ở product noun, card count, density, color, component hoặc state.

### Boundary verdict

Trả `accept` khi selection rule và parity pass. Trả `reject` cho rejection evidence, `duplicate-or-variation` cho biến thể noun hoặc presentation, và `needs-evidence` khi thiếu một fact phân biệt.

## Handoff

Grammar gán semantic và product owner cho từng region. Principles resolve exact grid, measure, gap, size, alignment, overflow exception và breakpoint sau topology selection. Direction resolve visual character.

## Non-binding research evidence

### Evidence boundary

Các nguồn official này là evidence advisory cho topology, interaction và accessibility. Chúng không phải product truth, không biến tên archetype tổng hợp thành thuật ngữ official và không cấp quyền copy geometry, component tree, breakpoint hoặc visual treatment.

### Sources

| Source | What it supports | What it does not prove |
|---|---|---|
| [Adobe Spectrum — Components](https://spectrum.adobe.com/page/components/) | Evidence cho component interaction evidence across media and controls. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |
| [Atlassian Design System — Components](https://atlassian.design/components/) | Evidence cho navigation, disclosure, and selection behavior. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |
| [GitLab Pajamas — Patterns](https://design.gitlab.com/patterns/) | Evidence cho search, navigation, and result-state patterns. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |
| [W3C ARIA APG — Tree View Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/) | Evidence cho hierarchy semantics, selection, and keyboard movement. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |
| [W3C WCAG 2.2 — Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Evidence cho reflow without two-dimensional page scrolling. | Không chứng minh product truth, exact geometry, component tree hoặc breakpoint. |

## Output

```text
archetypeId: hierarchical-content-browser
situationCodes: AR-HCB-01, AR-HCB-02, AR-HCB-03, AR-HCB-04, AR-HCB-05
searchAliases: taxonomy browser, folder browser, content tree, hierarchical index
dominantTask: Đi qua taxonomy hoặc folder tree và inspect content index thuộc node hiện tại.
regions: content-browser, hierarchy-navigation, current-path, node-content-index, optional-context-preview
regionRelationships: content-browser → hierarchy-navigation → current-path → node-content-index → optional-context-preview
responsive:
  wide: Giữ hierarchy navigation cạnh index của node hiện tại; preview là tùy chọn và không bao giờ là cấp semantic thứ ba bắt buộc.
  intermediate: Chuyển hierarchy vào rail có thể thu gọn hoặc drawer trong khi current path vẫn nhìn thấy.
  compact: Drill down từng cấp với breadcrumb hoặc Back, sau đó là index của node hiện tại.
  reflow: semantic and DOM order follow the declared region graph
  readingOrder: content-browser → hierarchy-navigation → current-path → node-content-index → optional-context-preview
  navigationReplacement: Dùng drill-down từng cấp bằng breadcrumb/Back, sau đó là current node index.
  stickyBehavior: Không ép desktop tree vào permanent overlay.
  overflowOwner: Active level và index share page flow; inactive level không tạo scroll.
  interactionParity: every action, state, recovery route, and keyboard path survives
stateObligations: the families in the state matrix
boundaryVerdict: accept | reject | needs-evidence | duplicate-or-variation
grammarHandoff: assign product-semantic owners to required regions
principlesHandoff: resolve exact grid, measure, gap, size, alignment, overflow, and breakpoint
confidence: high — prompt contract and official multi-source evidence converge
evidenceClasses: prompt contract, official interaction guidance, official accessibility guidance
```
