---
title: Rà soát chất lượng frontend
---

# Rà soát chất lượng frontend

## LOADS

| Alias | Đích | Loại | Lý do |
|---|---|---|---|
| `@schema` | `brainstorms/frontend-quality/schema.json` | file | kiểm tra receipt chất lượng tích hợp của một candidate |
| `@validate-artifact` | `scripts/validate-artifact.mjs` | script | cưỡng chế đủ lens, đúng biên advisory và đóng detector |

## Bản ghi

Module này gom các năng lực hữu ích của những skill frontend-design, UI/UX intelligence, interface guideline,
React performance, composition, accessibility và design review công khai vào một lượt rà brainstorm của StarCi.
Nó không sao chép lựa chọn hình ảnh của họ và không biến họ thành authority sản phẩm. Layout, Block và Refactor
có chung một cách phản biện direction trước khi owner phải dùng approval.

## Biên authority

Business truth đã route, Grammar, MASTER, ownership source hiện tại và evidence sản phẩm đã render là binding.
Skill, catalogue và guideline bên ngoài chỉ là evidence advisory. Chúng được phép mở rộng câu hỏi hoặc chỉ ra một
defect candidate, nhưng không được thêm journey step, route, state, action, field, token, component hay source file.
Mỗi recommendation được nhận phải viết lại thành decision do StarCi sở hữu và map vào `business`, `grammar`,
`principle`, `pattern`, `gate` hoặc `source`.

Không bắt buộc package ngoài hay network call. Khi có dùng source đã cài hoặc đã fetch, phải ghi locator và content
digest. Instruction live chưa pin không thể thành binding input.

## Các họ evidence tích hợp

| Họ | Phần đóng góp cho review | Biên |
|---|---|---|
| craft khác biệt | character theo đúng subject, hierarchy có chủ ý, typography, một điểm nhớ được và phản biện anti-template | MASTER và Grammar đã route vẫn khóa product family |
| intelligence tra cứu | recommendation theo product/style/palette/type/chart/stack và UX pattern đã biết | chỉ recommendation; không chép vào authority |
| chất lượng interface | accessibility, focus, form, touch, navigation, content overflow, locale và error recovery | obligation quan sát được phải map tới proof |
| kỹ thuật React | waterfall, bundle/render cost, component composition và shape state/API | chỉ áp dụng cho stack đã phát hiện và source chain chính xác |
| review incumbent system | tuân thủ design system, token/component hiện tại, responsive behavior và interaction đáng tin | phải chứng minh governing owner, không suy từ tên |
| detector tất định | check anti-pattern, accessibility, responsive, motion, performance và composition lặp lại được | output detector là evidence, không phải design decision |

## Map advisory source

Map này ghi loại câu hỏi có thể học khi source thật sự available; nó không import source hay pin một live version.
Run nào consult source thì phải ghi locator cùng digest trong `sources`.

| Advisory family | Câu hỏi nó có thể làm mạnh hơn | Đích StarCi |
|---|---|---|
| Anthropic frontend-design | hierarchy, typography, composition có chủ ý cùng visual character riêng cho subject | `product-fit`, `visual-character`, `design-system` |
| Impeccable | critique có cấu trúc, accessibility, responsive, interaction, copy, motion và anti-pattern detection | các lens áp dụng được cùng sáu detector family |
| UI UX Pro Max | recommendation có thể tra theo product/style/palette/type/chart/stack | evidence cho `visual-character`, `design-system`, `responsive-content`, `performance-motion` |
| Vercel Web Interface Guidelines | semantics, focus, form, touch, navigation, overflow, content và error feedback | `accessibility`, `interaction`, `responsive-content`, `copy-localization` |
| Vercel React Best Practices | waterfall, bundle, render và client-performance risk | `performance-motion`, `component-composition` |
| Vercel composition patterns | compound composition, state/API ownership và boolean-mode pressure | `component-composition`, `state-resilience` |
| ibelick UI Skills | baseline cleanup thực dụng cùng implementation-level interface review | `design-system`, `accessibility`, `responsive-content` |
| Microsoft frontend design review | design-system fit, accessibility và cross-viewport implementation review | `design-system`, `accessibility`, `interaction`, `responsive-content` |
| Taste Skill | anti-generic character cùng restraint check trong product domain nó khai | `visual-character`; domain exclusion vẫn là exclusion |

Tên trong bảng chỉ là routing label. Recommendation vẫn là advisory dù nhiều nguồn cùng đồng ý.

## Quy trình review

1. Đóng băng cùng scope, facts, content, MASTER, page set và viewport set mà candidate dùng.
2. Inventory binding source trước. Chỉ thêm receipt external advisory khi nó thay đổi đáng kể một câu hỏi hoặc
   phát hiện risk kiểm chứng được.
3. Rà candidate qua toàn bộ closed lens bên dưới. Draft còn revision chưa giải quyết phải sửa hoặc loại trước khi
   vào batch candidate của Layout/Block.
4. Gọi tên một character move riêng cho sản phẩm. Nó có thể kế thừa từ parent hoặc MASTER; nó phải mã hóa subject,
   quan hệ hoặc task thật và không được chỉ là trang trí.
5. Chạy mọi detector family trên frozen HTML hoặc source evidence hiện có ở stage đó. Ghi `pass` hoặc
   `not-applicable` có evidence; finding chưa xử lý làm candidate không đủ điều kiện.
6. Validate receipt canonical và gắn nguyên vẹn vào candidate. Layout state expansion giữ receipt đã approve
   byte-for-byte.

## Closed lens

| Lens | Câu hỏi |
|---|---|
| `product-fit` | Direction có làm rõ job, decisive action và outcome của actor mà không bịa product truth không? |
| `visual-character` | Kết quả có riêng cho sản phẩm này và tránh default AI/template chung chung không? |
| `design-system` | Nó có giữ hoặc route rõ mọi deviation khỏi MASTER, token và component đang cai quản không? |
| `accessibility` | Semantics, contrast, focus, keyboard, touch và assistive feedback đã được biểu diễn chưa? |
| `interaction` | Navigation, feedback, destructive action và interruption/recovery có đoán trước được không? |
| `responsive-content` | Hierarchy, content dài, localization, zoom và narrow layout có còn thao tác được không? |
| `performance-motion` | Motion có mục đích, an toàn reduced-motion và từ chối layout/bundle/render cost tránh được không? |
| `component-composition` | Direction có khớp component/state ownership chain thật mà không rò prop hay boolean mode không? |
| `state-resilience` | Loading, empty, ready, error, permission, disabled và overlay có owner và recovery không? |
| `copy-localization` | Label có cụ thể, ổn định xuyên flow, source-owned và chịu được locale expansion không? |

`product-fit`, `visual-character`, `design-system`, `accessibility`, `responsive-content` và `state-resilience`
luôn trả `pass`. Lens khác chỉ được `not-applicable` với evidence cụ thể. Mỗi decision của lens gọi tên StarCi owner
và proof sẽ đóng nó.

## Các họ detector

Mỗi candidate đủ điều kiện ghi đúng một kết quả cho `semantics-a11y`, `interaction-feedback`,
`responsive-overflow`, `motion-performance`, `react-composition` và `state-content`. Họ thứ nhất, thứ ba và thứ sáu
luôn pass. Detector chỉ được `not-applicable` khi technology hoặc interaction mà nó kiểm tra thực sự không tồn tại.

## Số candidate

Review này không sinh alternatives. Layout, Block hoặc Refactor vẫn phát đúng một direction mặc định. Khi owner
yêu cầu brainstorm rõ ràng trước `OK #1`, mỗi trong ba hoặc bốn alternative hoàn chỉnh có review riêng trên cùng
facts và content. Draft yếu hoặc invalid bị loại thay vì đưa ra làm option. Style, palette hay font ngoài tự thân
không tạo thành direction khác biệt đáng kể.

## Output

Một JSON receipt canonical theo `@schema`, gắn vào candidate được review. Validate trước khi sinh HTML và một lần
nữa trước `OK #1`:

```bash
node @validate-artifact --schema @schema --data <frontend-quality.json> --hash
```

Receipt là session evidence. Nó chỉ được approval bind khi nằm trong page hash schema 9 của Layout, anatomy
schema 3 của Block hoặc displayed direction boundary của Refactor.
