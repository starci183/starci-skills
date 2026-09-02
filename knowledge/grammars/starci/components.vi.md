# Ma trận component StarCi Core

Mọi public renderer và prop type đến từ `@starci/grammar/common`. Core chỉ thay `GrammarRoot`; mọi renderer khác được kế thừa và nhận Core visual DNA qua scoped CSS.

| Common renderer | Common contract | Cách Core hiện thực | Luật UI và idiom StarCi áp dụng |
| --- | --- | --- | --- |
| `GrammarRoot` | Boundary div/theme neutral | `CoreGrammarRoot` cài family scope | TONE-1, A11Y-4 |
| `PageContainer` | Measure product/reading/full và page inset | Core bind measure và spacing alias | LAYOUT-1, MARGIN-1, PADDING-2 |
| `Badge` | Identity/status ngắn có tone | Core map tone neutral/accent/state | TONE-2, STATE-1 |
| `Button` | Native command/submit, visible label, pending lock | Core map size/variant; danger variant là Common gap | ACTION-1..2, CTA-1..5 |
| `Divider` | Separator có visible label tùy chọn | Core bind separator material | BOUNDARY-5 |
| `Heading` | HTML level explicit và visual scale | Core bind typography không đổi rank | FONT-1, FONT-4 |
| `Icon` | Glyph theo role dạng decorative hoặc có tên | Core bind geometry và tone | TONE-2 |
| `IconTile` | Icon plate ổn định cho identity/state | Core bind size/tone/radius | ACCENT-2, MEASURE-2 |
| `IconButton` | Native icon command bắt buộc label | Core bind target và focus | A11Y-2 |
| `Label` | Visible name cho field/region | Core chỉ bind typography | A11Y-1, FONT-3 |
| `Input` | Label, value, hint/error, validity và disabled state | Core bind field material | FEEDBACK-1, Single-column form stack |
| `Progress` | Value đo được có tên 0..100 | Core bind track/fill | A11Y-3, ACCENT-4 |
| `Text` | Semantic element, size/tone/weight/live/skeleton | Core bind type; recipe standalone còn thiếu là Common gap | FONT-1..5, TRUTH-1 |
| `TextAction` | Button semantics có appearance giống link và pending lock | Core dùng chung action style | ACTION-1..3 |
| `SectionHeader` | Hierarchy eyebrow/title/description/action | Core bind type và rhythm | HIERARCHY-1..3 |
| `MediaFrame` | Aspect/fit/treatment/caption/frame | Core bind family material; prop loading/error là Common gap | Generated art is a band, not a card |
| `IncludedMark` | Mark included-offering dạng decorative | Core bind geometry 20px; không claim completion | TRUTH-1 |
| `RankArtwork` | Rank art decorative có tên theo purpose | Core present; feature resolve truth | TRUTH-2 |
| `SurfaceCopyGroup` | Rhythm title/explanation compact | Core bind rhythm; recipe exact 4px là Common gap | FONT-3, GAP-1, Title and one supporting line |
| `PrimaryRailLayout` | Composition primary/rail vô danh | Core bind track và stacking | LAYOUT-2, RESPONSIVE-2 |
| `NavigationFeatureNav` | Projection navigation primary/compact vô danh | Core bind breakpoint và separator | RESPONSIVE-2..3 |
| `Sidebar` | Rail/drawer theo group có callback selection/collapse | Core bind family appearance; product sở hữu route/persistence | LAYOUT-2, STATE-2 |
| `WorkspaceShell` | Layout navigation/primary/rail/header/floating vô danh | Core bind responsive grid và absence zero-footprint | LAYOUT-2..4, RESPONSIVE-3 |
| `ChatWorkspace` | Conversation/composer/rail có drawer projection | Core bind scroll/responsive rail | LAYOUT-2..4, RESPONSIVE-2 |
| `StateMark` | Carrier presentation-state compact | Core map state treatment | STATE-1 |
| `LeadingNumber` | Anatomy số thứ tự dẫn đầu | Core giữ visually quiet | HIERARCHY-3 |
| `OtpInput` | Field one-time-code theo group | Core bind field geometry | Single-column form stack |
| `StaticStateRow` | Row không command cho một state đã verify | Core map presentation state | TRUTH-2, STATE-1 |
| `EmptyNotice` | Notice empty/failed/unavailable có action tùy chọn | Core present; feature sở hữu truth/recovery | FEEDBACK-2, STATE-1 |
| `HorizontalScrollRegion` | Một horizontal overflow owner reachable | Core giữ chrome yên nhưng không disable scroll | MEASURE-4, RESPONSIVE-4 |
| `VerticalScrollRegion` | Một vertical overflow owner reachable | Core giữ containment/focus | LAYOUT-3, MEASURE-4 |
| `SurfaceCard` | Label/state/depth/frame/scroll/composition/whole action | Core paint labelled card thành một material box có label-inside | Joined bands in one flush card, One highlighted card |
| `SurfaceListCard` | Collection repeated-peer có label | Core bind shared seam/material | GAP-3, Joined bands in one flush card |
| `FencedCodeBlock` | Semantic code boundary và overflow | Core bind code material | MEASURE-4 |
| `MarkdownArticle` | Semantic prose rhythm/reading owner | Core bind reading measure/type | FONT-1, MARGIN-1 |
| `MarkdownTableFrame` | Table overflow frame reachable | Core bind boundary/scroll | MEASURE-4 |
| `SurfaceAccordionCard` | Controlled disclosure có geometry ổn định | Core bind state/focus | STATE-3, STATE-1 |
| `Rail` | Auxiliary header/body/footer/scroll region có tên | Core bind sticky/contained behavior | LAYOUT-2..3 |
| `Subnav` | Region identity/toggle compact hoặc sticky | Core bind visibility và target | RESPONSIVE-2..3, FOCUS-1 |
| `Tabs` | Persistent peer-view selection controlled | Core bind indicator/overflow/focus | STATE-2 |
| `Tooltip` | Description bổ sung cho control đã có | Core style; không thay accessible name | A11Y-2 |

## Support contract

Common còn export presentation-state guard, form/scroll class-name helper, `COMMON_SPACING_SCALE`, `COMMON_SPACING_TOKENS`, `COMMON_UI_RULE_IDS` và family/conformance factory. Đây là support contract, không phải visual component thêm.
