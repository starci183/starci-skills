---
id: fe-layouts-proofs-index
title: Proofs — layouts
slug: /fe/layouts/proofs
sidebar_label: Proofs
description: Bảng điểm phép thử giữ kín đáp án cho ba trang founder tự tin, và danh sách luật gate còn thiếu ở tầng layout.
---

# Proofs — layouts

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
