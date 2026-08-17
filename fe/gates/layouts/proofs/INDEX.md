---
id: fe-layouts-proofs-index
title: Proofs — layouts
slug: /gates/layouts/proofs
sidebar_label: Proofs
description: Bảng điểm phép thử giữ kín đáp án cho ba trang founder tự tin, và danh sách luật gate còn thiếu ở tầng layout.
---

# Proofs — layouts

## Net-new golden cases

These cases test the new business-to-layout contract rather than reconstruction of a shipped screen.
Each record preserves a raw prompt and contains three complete, schema-shaped candidates whose plans
have exactly `business`, `main`, and `extends`.

| Case | Prompt | Candidate axes |
|---|---|---|
| [Gift shop](./gift-shop.md) | Create a StarCi gift shop | discovery-first · balance-first · mission-first |
| [Mentor booking](./mentor-booking.md) | Create mentor booking | mentor-first · availability-first · goal-first |
| [Community events](./community-events.md) | Create community events | calendar-first · discovery-first · community-first |
| [Team learning dashboard](./team-learning-dashboard.md) | Create a team learning dashboard | risk-first · progress-first · action-first |

Validation target: `gate.schema.json#/$defs/LayoutPlanSet`. These are golden shape/decision proofs;
they do not claim that proposed business blocks already exist in frontend source.

### Runtime handoff shapes

`recommendation.json` is advice and `decision.json` is the founder's authorization. Both bind to the
reviewed candidate bytes by SHA-256:

```json
{
  "recommendation.json": {
    "decisionId": "gift-shop",
    "recommendedCandidateId": "01",
    "candidateHash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "reason": {
      "why": "Discovery-first answers the unqualified shop prompt with the fewest extra assumptions.",
      "anchorKind": "business-input",
      "anchor": "input.json#/raw"
    }
  },
  "decision.json": {
    "decisionId": "gift-shop",
    "chosenCandidateId": "01",
    "candidateHash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "decidedBy": "founder",
    "why": "Use discovery-first for the first materialization pass."
  }
}
```

> Gate: layouts · Ngày: 2026-08-16 · Phép thử: một agent đọc code ghi cấu trúc thật, một agent khác chỉ nhận yêu cầu nghiệp vụ cộng gate và dựng lại từ đầu.

Trang này giữ hai lần chấm:

- **Lần 1 — phép thử một-gate** (bên dưới): mỗi màn được dựng lại độc lập từ yêu cầu nghiệp vụ.
- **Lần 2 — [phép thử chuỗi đầy đủ](#lần-2--phép-thử-chuỗi-đầy-đủ)**: năm gate chạy nối tiếp, mỗi gate chỉ nhận đầu ra gate trước, không gate nào đọc repo.

## Bảng điểm

| Màn | Trang | Mục chấm | TRÚNG | KHÁC MÀ ĐƯỢC | LỆCH | THIẾU | Tỉ lệ trúng |
|---|---|---|---|---|---|---|---|
| [DashboardPage](./DashboardPage.md) | dashboard | 28 | 17 | 1 | 6 | 4 | 61% |
| [CoursesCatalogPage](./CoursesCatalogPage.md) | courses | 27 | 13 | 1 | 8 | 5 | 48% |
| [CourseDetailPage](./CourseDetailPage.md) | course-details | 27 | 11 | 1 | 7 | 8 | 41% |
| **Cộng** | | **82** | **41** | **3** | **21** | **17** | **50%** |

Một nửa. Và mức trúng tụt đều theo độ phức tạp của trang: trang càng nhiều tầng thì gate càng hụt.

## Gate còn thiếu

Xếp theo số màn chứng minh nó cần.

### 3 màn

1. **Khi nghiệp vụ không nói trạng thái có đáng gửi cho người khác hay không, đó là câu HỎI NGƯỢC người dùng, không phải chỗ suy diễn.** Câu 3 của gate chỉ chạy đúng ở dashboard, nơi nghiệp vụ nói thẳng "chia sẻ được bằng đường dẫn"; ở catalog nghiệp vụ im và bản mù đẩy `q`/`page` lên URL trong khi mã thật giữ ở bộ nhớ.
2. **Khi trạng thái phải lên URL: mode song song trong cùng một page owner đi bằng query param trên MỘT route; route con chỉ khi mỗi mode có breadcrumb, metadata hoặc landmark riêng.** Bản mù chọn bốn route con cho dashboard; mã thật là `?tab=`. Gate có L4 và L5 nhưng không có câu phân xử.
3. **Overlay mount ở page owner như sibling của cây trang; khối chỉ phát ý định mở.** Ba trang, ba overlay (`pricedCourseId` ở CoursesTab, `pricedCourseId` ở catalog, `CoursePriceOverlay` ở detail) và cả ba đều do trang sở hữu. Gate chỉ có L6 nói *bên trong* overlay.
4. **Khai rõ ngưỡng là viewport hay container, mặc định là viewport.** Cả ba trang dùng viewport (`md:`, `sm:`, `lg:`); một archetype anh em (`profile-identity-rail`) lại dùng container. Không bản mù nào nói được loại truy vấn.

### 2 màn

5. **Nhánh hẹp phải khai cho MỌI archetype, không chỉ `frame-with-nav-rail`. Rail chỉ đổi thành thanh dính đáy khi rail chứa một CAM KẾT; rail mang danh tính, số liệu và lối tắt thì xếp dọc lên trên body và không dính.** Dashboard: bản mù bịa một thanh đáy không tồn tại. Detail: bản mù mượn đúng, nhờ may.
6. **Một trang được phép mang nhiều tầng archetype cùng lúc: một dải dính đỉnh, một thân rail-and-main và một thanh dính đáy là ba tầng của cùng một trang.** Detail có đủ ba; dashboard có rail ở tầng trang và tab ở tầng navbar. Gate bắt chọn một trong bốn nên bản mù mất tầng.
7. **Thanh chuyển mode và điều hướng nội trang thuộc chrome của route cluster (tầng hai của navbar), không thuộc rail của trang.** Dashboard: thanh tab nằm trong `ShellNav`. Detail: `course-section-navigation` sticky ngay dưới navbar. Gate có L3 mô tả tầng hai nhưng không có câu bắt nhận ra hai thứ này chính là nó.
8. **Tư cách người xem với đối tượng là DỮ KIỆN nửa connected chốt rồi đổ vào props, không phải state cấp màn hình. State cấp màn hình chỉ dành cho thứ quyết định trang có tồn tại hay không.** Detail: bản mù dựng ba state guest/member/enrolled. Dashboard: bản mù bịa `identity-failed`.
9. **restingCount khai ở contract, khối đọc ngược từ contract, và con số là số hàng ĐIỂN HÌNH của một lần trả — không phải page size.** Catalog: page size 9 nhưng số thẻ nghỉ là 3. Detail: 6/5/5/3/3 đọc từ `CONTRACTS`.
10. **Vùng tuỳ chọn VẮNG MẶT khỏi cây (không dựng slot), không phải slot chứa null.** Catalog dựng bằng spread có điều kiện; detail có `action` optional. Gate chỉ có B4 cho khối rỗng.

### 1 màn

11. **Trong lúc phiên chưa giải, trang trả rỗng chứ không vẽ khung nghỉ** — hình dạng của người chưa đăng nhập không tồn tại. (dashboard)
12. **Đổi lưới ↔ danh sách là trình bày: một component thẻ mang cả hai bố cục qua prop, công tắc ở thanh điều khiển của run, lựa chọn được nhớ.** (catalog)
13. **`failed` và `not-found` thay TOÀN BỘ cây trang; chỉ `failed` được retry.** (detail)
14. **Các con số quy mô và bằng chứng của một đối tượng đứng chung một bảng có số ô cố định, ngay dưới danh tính.** (detail)
15. **Một dải điều khiển chỉ dính đỉnh khi nội dung dài hơn một màn VÀ điều khiển phải với tới được giữa chừng cuộn.** Gate liệt kê `sticky-top-chrome` mà không cho điều kiện chọn. (catalog)
16. **Không được thêm state cấp màn hình nào nghiệp vụ không nêu** — B5 ở tầng khối chưa có bản sao ở tầng màn. (dashboard)
17. **Nhánh không đạt tới được từ đường sống là mã chết, không phải một trạng thái.** (dashboard)
18. **Lọc bỏ dữ liệu sau khi đã nhận một trang là lỗi tổng-số-và-phân-trang; query phải nhận danh tính người xem và tự trừ.** (catalog — bản mù nêu được, mã thật thì không)

## Chỗ gate im lặng nhất

Gom từ trường `uncertain` của cả ba bản dựng mù, xếp theo số bản cùng phải đoán.

| Chỗ im lặng | Số bản mù phải đoán |
|---|---|
| restingCount: gate bắt có, không cho quy tắc suy ra con số | 3/3 |
| Rail nằm bên nào — không một chữ nào trong gate | 3/3 |
| Nhánh hẹp của các archetype không phải `frame-with-nav-rail`, và ngưỡng breakpoint | 3/3 |
| Tập state cấp màn hình chuẩn (câu 6 chỉ hỏi, không cho danh sách) | 3/3 |
| Ai sở hữu request: page owner hay chính khối | 3/3 |
| `standing-figure` "không có failed riêng" mâu thuẫn với thang state chuẩn | 2/3 (một bản gọi thẳng đây là mâu thuẫn của gate, không phải chỗ thiếu tin) |
| Tiết lộ tại chỗ hay overlay | 2/3 |
| URL ghi bằng push hay replace, và anchor thuộc URL hay bộ nhớ | 2/3 |
| Vùng rỗng: ẩn cả vùng hay vẽ trạng thái rỗng (phạm vi của B4) | 2/3 |
| Thứ tự các khối bên trong một vùng (B8 chỉ nói nhóm trước gap sau) | 2/3 |
| Khoá cache có phải mang danh tính người xem không | 1/3 (gate không có một chữ nào về cache) |
| B9 và B12 không có trong bản gate được cấp | 2/3 nêu thẳng |

---

## Lần 2 — phép thử chuỗi đầy đủ

> Ngày: 2026-08-16 · Chuỗi: layouts → blocks → principles → patterns → lints · Mỗi gate chỉ nhận đầu ra gate trước; không gate nào đọc repo.

### Bảng điểm

| Trang | best-of-set | recommended | TRÚNG | KHÁC MÀ ĐƯỢC | LỆCH | THIẾU | Không đo được |
|---|---|---|---|---|---|---|---|
| [dashboard](./dashboard.md) | không đo được | **9.5/16 · 59%** | 9 | 1 | 3 | 3 | 0 |
| [courses](./courses.md) | không đo được | **3/10 · 30%** | 3 | 0 | 4 | 3 | 5 |
| [course-details](./course-details.md) | không đo được | **7/14 · 50%** | 7 | 0 | 5 | 2 | 2 |
| **Trung bình** | — | **46%** | | | | | |

**Vì sao best-of-set không đo được ở cả ba trang.** Gate layouts được yêu cầu trả 3–4 phương án; chuỗi mù chỉ mang **một** phương án qua ranh giới layouts → blocks. Ba phương án còn lại không tồn tại trong đầu vào của các gate sau và không tồn tại trong bản ghi. Nghĩa là **không ai — kể cả người chấm — có thể biết gate đã đẻ ra phương án đúng rồi khuyên nhầm, hay chưa bao giờ đẻ ra nó.** Đây là lỗi của giao thức chuỗi, không phải của gate: cận dưới của best-of-set bằng đúng điểm recommended, và khoảng cách giữa hai con số bị vứt đi ở ranh giới đầu tiên.

Sửa: `output` của gate layouts và gate blocks phải mang cả tập phương án qua ranh giới, kèm đúng một trường `recommended`.

### Gate còn thiếu luật gì (lần 2)

| # | Câu luật lẽ ra đã ngăn được | Trang |
|---|---|---|
| 1 | **Measure của một trang thuộc về đúng một node, và node đó phải được gọi tên tại gate layouts.** | 3/3 |
| 2 | **Gate phải chỉ đích danh file mở landmark `main`; khai `mainLandmarkOwner` mà không có file tương ứng là một lời khai không có chủ.** | 3/3 |
| 3 | **Tập state của một màn hình phải bao gồm người chưa đăng nhập, kể cả khi câu trả lời là không vẽ gì.** | 2/3 |
| 4 | **Trang phải liệt kê từng vùng cấp một cùng với bắt buộc hay tùy chọn, và "tùy chọn" nghĩa là slot KHÔNG TỒN TẠI.** | 2/3 |
| 5 | **Nếu một slot nhận nhiều hơn một hình dạng thì nó là một union được liệt kê, không phải một khoá gộp.** | 2/3 |
| 6 | **Hai trạng thái do hai nguyên nhân khác nhau phải mang hai tên khác nhau**: `empty` ≠ `not-found` ≠ `filtered-empty` ≠ `failed`. | 2/3 |
| 7 | **Nếu một cụm có nhịp dữ liệu riêng thì nó có thang state riêng, liệt kê ngay tại gate layouts.** | 1/3 |
| 8 | **Nếu cột đọc dài hơn một màn thì phải quyết định có vùng điều hướng theo phần hay không.** | 1/3 |
| 9 | **Preference của người đọc phải nói rõ nó sống ở đâu và ai hydrate nó.** | 1/3 |

Bốn câu 1, 3, 6, 9 trùng đúng với các câu 11, 13, 1 và 12 của lần 1 — nghĩa là **cùng một chỗ thiếu bị bắt lại lần thứ hai bằng một phép thử khác.**

### Chỗ gate im lặng nhất (lần 2)

`uncertain` của gate layouts **không tồn tại trong chuỗi mù**. Đây là chỗ im lặng lớn nhất của lần 2: gate đầu tiên là gate duy nhất còn có thể hỏi ngược người dùng trước khi mọi thứ khác được suy ra từ một giả định, và không có bản ghi nào cho thấy nó đã hỏi hay đã im.

Ba câu hỏi thuộc gate layouts nhưng chỉ được nêu ra ở gate cuối, sau khi mã đã được viết:

1. Ai giữ landmark `main` — layout của route family hay trang? (dashboard, course-details)
2. Một landmark do entry mở thì lấy nhãn đọc được ở đâu, khi frame chỉ phát `data-node`, `data-why`, `className`? (courses)
3. Một trang có bao nhiêu chủ hành động, và hành động đi xuống bằng đường nào? (course-details)

## Lượt 2 — 2026-08-17

### Bảng điểm

| Trang | Lượt 1 (recommended) | Lượt 2 (recommended) | Delta | best-of-set |
|---|---|---|---|---|
| [dashboard](./dashboard.md) | 9.5/16 · **59%** | 12.5/16 · **78%** | **+19** | không đo được |
| [courses](./courses.md) | 3/10 · **30%** | 6/15 · **40%** | **+10** | không đo được |
| [course-details](./course-details.md) | 7/14 · **50%** | `null` · **0%** | **−50** | không đo được |
| **Trung bình hai trang chạy được** | **44.5%** | **59%** | **+14.5** | |
| **Trung bình ba trang** | **46.3%** | **39.3%** | **−7** | |

### Best-of-set vẫn không đo được ở cả ba ô — và lần này biết vì sao

Lược đồ `output` của gate layouts đã được vá thành **tập phương án**. Ô vá đó không thay đổi gì, vì
thứ đi qua ranh giới sang người chấm vẫn là **một** đối tượng cho mỗi trang, và đối tượng đó là đầu
ra của gate CUỐI. Chỗ hỏng không nằm ở lược đồ của gate layouts, nó nằm ở **đường truyền**: chuỗi
chuyển tiếp đúng một giá trị mỗi trang thay vì một mảng năm bước.

Câu luật cần thêm: *chuỗi phải mang qua ranh giới một BẢN GHI mỗi bước, không phải giá trị trả về của
bước cuối. Không có bản ghi thì gate 1 và 2 không bao giờ chấm được trục best-of-set, và một gate đẻ
đúng phương án nhưng khuyên nhầm sẽ mãi mãi bị chấm như một gate không đẻ ra phương án nào.*

### Cái đã khá lên

Toàn bộ mức tăng của trang dashboard nằm trong một cụm bốn mục và cụm đó rất cụ thể: **measure, seam
và breakpoint của entry gốc**. Lượt một trang này viết `dashboard-rail-then-main` với bốn class và
mất `mx-auto max-w-6xl px-6 py-6`, mất `gap-6`, mất `md:items-start`. Lượt hai viết đủ mười lăm class,
đúng thứ tự, và đặt ràng buộc bề rộng lên CHA bằng selector nhắm-con thay vì đẩy xuống con. Đây là ô
`SourceFile.source` cộng 291 tên khoá cùng ăn.

Trang courses tăng ở mẫu số nhiều hơn ở tử số: **năm mục lượt một ghi "không đo được" thì lượt hai đo
được cả năm, và bốn trong năm đỏ.** Lượt một đang giấu bốn lỗi chứ không phải không có chúng.

### Gate còn thiếu luật gì

| # | Câu luật lẽ ra đã ngăn được | Trang | Trạng thái |
|---|---|---|---|
| 1 | **Bố cục phải liệt kê tập NGƯỜI XEM trước khi liệt kê vùng, và mỗi người xem được gán một cây, kể cả cây rỗng.** | 2/3 | nêu lượt 1, chưa vá |
| 2 | **Entry gốc của trang phải khai measure, hoặc chỉ ra node nào ở trên nó giữ measure.** | 2/3 | dashboard đã vá, courses vẫn hỏng |
| 3 | **Số vùng cấp một phải khai và phải khớp; "tuỳ chọn" nghĩa là slot KHÔNG TỒN TẠI.** | 2/3 | chưa vá — vùng owned chết hai lượt liên tiếp |
| 4 | **Union của một slot phải liệt kê đủ; một thành viên bị bỏ là một mặt sản phẩm biến mất.** | 2/3 | chưa vá — `dashboard-tab-main` rơi hai lượt |
| 5 | **Trạng thái do người dùng tạo ra (lọc còn 0) tách khỏi kho rỗng và tách khỏi hỏng.** | 1/3 | chưa vá, và lượt 2 còn tụt thêm (`failed` biến mất) |
| 6 | **Preference của người đọc phải nói rõ ai giữ và ai hydrate.** | 1/3 | **đã vá** — lượt 2 có `VIEW_STORAGE_KEY` |
| 7 | **Điều khiển đã có leaf trong từ vựng thì không được đẻ khoá bố cục cho nó.** | 1/3 | nửa vá — `ViewModeSwitch` hết, `page-mark-run-between-steps` còn |
| 8 | **Một bước không chạy được phải trả về đối tượng nói nó không chạy được, không bao giờ `null`.** | 1/3 | **mới ở lượt 2**, và là câu đắt nhất |

### Gate im lặng ở đâu

Câu im lặng lớn nhất của gate layouts qua hai lượt vẫn nguyên một câu: **bảng contract thật đang có
gì.** Lượt hai được cấp 291 TÊN và trục tên nhảy vọt; nhưng `children`, `restingCount` và `host` của
những khoá đó thì không được cấp, nên gate đúng tên mà sai hình dạng con — đó chính là chỗ QuickActions
biến mất khỏi rail dù `dashboard-rail` được viết đúng từng ký tự.

Câu thứ hai là một câu **hỏi ngược**, không phải một câu thiếu luật: *bốn mặt của dashboard là bốn giá
trị của một tham số hay bốn địa chỉ?* Lượt một chọn `searchParams` và trúng, lượt hai chọn bốn route
và trượt, cả hai lần đều không có căn cứ trong câu nghiệp vụ. Thêm luật ở đây là vá nhầm.
