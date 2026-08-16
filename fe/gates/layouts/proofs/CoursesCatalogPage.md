---
id: fe-layouts-proof-courses-catalog-page
title: CoursesCatalogPage
slug: /gates/layouts/proofs/courses-catalog-page
sidebar_label: CoursesCatalogPage
description: Chấm bản dựng mù của trang danh mục khóa học so với cấu trúc thật, và ghi lại những câu luật gate còn thiếu.
---

# CoursesCatalogPage

> Trang: courses · Gate: layouts · Ngày: 2026-08-16

## Yêu cầu nghiệp vụ

Người vào đây là học viên đã có tài khoản hoặc khách chưa đăng nhập, đến để tìm và chọn một khóa học phù hợp trong toàn bộ khóa mà StarCi đang bán. Mỗi khóa phải cho biết tên, ảnh bìa, số người đã tham gia, giá đang bán kèm giá gốc và mức giảm khi đợt giá hiện tại rẻ hơn, cùng những gì khóa đó hứa mang lại; người dùng gõ từ khóa để thu hẹp danh sách, biết còn bao nhiêu kết quả, và đi được qua từng trang vì danh mục dài hơn một màn hình. Khóa nào học viên đã sở hữu thì phải cho họ thấy đang học tới đâu và lối quay lại chỗ đang dở, và tuyệt đối không được chào bán lần nữa lẫn giữa những khóa chưa mua. Khi tìm không ra, khi chưa có khóa nào, hay khi hệ thống không trả lời được, phải nói rõ đang rơi vào trường hợp nào và cho người dùng một cách đi tiếp.

## Cấu trúc thật

| # | Mục | Sự thật | Neo |
|---|---|---|---|
| 1 | Archetype trang | `browse-and-filter`. Một cột dọc duy nhất `mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-6`. KHÔNG có sticky nào ở tầng trang | contracts/index.ts:2042,2048 |
| 2 | Có rail không | Không | contracts/index.ts:2042 |
| 3 | Số vùng và thứ tự | 6: header → toolbar → owned → discover → notice → pager | contracts/index.ts:2049 |
| 4 | Bắt buộc vs tuỳ chọn | Chỉ `header` và `toolbar` bắt buộc; 4 slot còn lại `optional: true` và VẮNG MẶT chứ không chứa null (`...(cond ? {} : { owned })`) | component.tsx:313,324 |
| 5 | header chứa gì | `page-header-stack`: breadcrumbs (Trang chủ > Khóa học) trên h1. Không có câu mô tả | contracts/index.ts:1513 · component.tsx:177 |
| 6 | toolbar chứa gì | `catalog-search-count-row`: cụm ô tìm + số kết quả ở một đầu, `ChoiceTabs` grid/line ở đầu kia | contracts/index.ts:2092 · component.tsx:195 |
| 7 | Công tắc lưới/danh sách | Có, `ChoiceTabs` variant primary, hai giá trị `grid` \| `line` | component.tsx:195 |
| 8 | q và page ở đâu | Bộ nhớ: `useState('')` và `useState(1)`; đổi q reset page về 1; gửi đi `pageNumber: page - 1`; PAGE_SIZE 9 | index.tsx:181,184 |
| 9 | view lưu ở đâu | `localStorage` key `starci.courses.view`, hydrate trong useEffect sau mount để tránh hydration mismatch | index.tsx:70 |
| 10 | State cấp màn | 5: pending, ready, empty, filtered-empty, failed | component.tsx:44 |
| 11 | Điều kiện failed | `catalog.error !== undefined \|\| catalog.data === null` — null nghĩa là server từ chối trả lời, khác undefined | component.tsx:44 |
| 12 | Nhóm owned bỏ phiếu vào state? | KHÔNG. Chỉ `discover` quyết state màn | component.tsx:44 |
| 13 | owned rỗng | Vùng biến mất (`hasOwned === true` mới dựng) | component.tsx:313 |
| 14 | owned dùng owner nào | `MyCoursesProgress` — khối KHÁC hẳn `CourseCatalogCard` của discover; trang không giữ nhãn, câu tiến độ hay nút resume nào | contracts/index.ts:1377 · component.tsx:250 |
| 15 | discover loại khoá đã sở hữu | Có, nửa connected lọc theo `isEnrolled` và `ownedIds` | index.tsx:51 |
| 16 | Lọc ở đâu | Ở FRONTEND, sau khi nhận trang | index.tsx:51 |
| 17 | Phân trang nằm ở đâu | Slot `pager` cấp trang, sibling của `discover`, không nằm trong run | component.tsx:339 |
| 18 | Pager khi chỉ 1 trang | Cố tình VẪN hiện: `showsPager = !showsNotice && !isLoading && totalPages !== undefined` | component.tsx:316 |
| 19 | restingCount thẻ | 3 (`RESTING_COUNT = 3`, khớp `restingCount: 3` của cả `catalog-card-grid` lẫn `catalog-card-list`) | component.tsx:123 · contracts/index.ts:2119,2126 |
| 20 | Page size | 9 | index.tsx:184 |
| 21 | Lưới khi hẹp | `grid-cols-1` → `sm:grid-cols-2` → `lg:grid-cols-3`, gap-2 | contracts/index.ts:2120 |
| 22 | Danh sách khi hẹp | `catalog-card-list` và `catalog-card-line` KHÔNG có tiền tố responsive nào; hàng vẫn là hàng ở mọi bề rộng, cover cố định `w-36 shrink-0` | contracts/index.ts:2133 |
| 23 | Loại truy vấn | Viewport media query (`sm:`/`lg:`); không container query nào trong cây này | contracts/index.ts:2120 |
| 24 | Ai mở landmark | Route layout (`nav-over-body-page` + `routed-page-main`); entry trang KHÔNG khai `host` nên Tree mở `div` | src/app/[lang]/courses/layout.tsx:27 · contracts/index.ts:741 |
| 25 | Overlay giá | `pricedCourseId` là state của TRANG; `CoursePriceOverlay` render như anh em ngang hàng của cây trang | index.tsx:51,84 |
| 26 | Cách nhận cây con | Chỉ `state` / `props` / `on`; không prop nào kiểu ReactNode; cây con qua prop `render` của Tree | component.tsx:116 |
| 27 | Sticky và offset | Không có sticky nào ở tầng trang, nên không có token offset nào | contracts/index.ts:2048 |

## Bản dựng mù

| # | Mục | Bản mù | Căn cứ bản mù nêu |
|---|---|---|---|
| 1 | Archetype trang | `sticky-top-chrome`: dải tìm-kiếm + đếm dính đỉnh, là sibling của nội dung | Câu 1 + 7 |
| 2 | Có rail không | Không — nghiệp vụ không nêu facet nào bền vững | Luật gốc |
| 3 | Số vùng và thứ tự | navbar (không thuộc trang) → tiêu đề → dải dính → EnrolledCourseRun → CourseCatalogRun | Câu 5, L1 |
| 4 | Bắt buộc vs tuỳ chọn | Không nói ở dạng slot; chỉ nói vùng "đang học" biến mất khi guest hoặc rỗng | — |
| 5 | header chứa gì | Tên trang + một câu mô tả danh mục, cuộn đi mất | Tự quyết để dải dính mỏng nhất |
| 6 | toolbar chứa gì | Ô tìm + số kết quả (`ResultCountFigure`) | L8 |
| 7 | Công tắc lưới/danh sách | Không nói | — |
| 8 | q và page ở đâu | URL `?q=&page=`; replace sau debounce cho q, push cho page | Câu 3 |
| 9 | view lưu ở đâu | Không nói | — |
| 10 | State cấp màn | failed, pending, empty-no-match, empty-none-exist, ready (+ ready đang refetch) | Thang state chuẩn + nghiệp vụ ép tách hai loại rỗng |
| 11 | Điều kiện failed | Có error VÀ chưa từng có data | Thang state chuẩn |
| 12 | Nhóm owned bỏ phiếu? | Không — hai run hai pending owner riêng | B11 |
| 13 | owned rỗng | Ẩn cả vùng (tự nhận là chỗ đoán, B4 mơ hồ) | Quyết định cấp layout |
| 14 | owned dùng owner nào | CHUNG owner thẻ với discover; chỉ khác run | B6 |
| 15 | discover loại khoá đã sở hữu | Có | Nghiệp vụ |
| 16 | Lọc ở đâu | Bắt buộc ở BACKEND — lọc sau phân trang sẽ làm số kết quả sai và trang thủng | Phát hiện cần backend |
| 17 | Phân trang nằm ở đâu | TRONG run | B3 |
| 18 | Pager khi 1 trang | VẮNG MẶT, không disabled | standing-offer |
| 19 | restingCount thẻ | 9 (3×3, bằng page size giả định) | Tự chọn |
| 20 | Page size | 9 | Tự chọn |
| 21 | Lưới khi hẹp | 3 → 2 → 1 cột | Câu 5 |
| 22 | Danh sách khi hẹp | Không nói (không biết có chế độ danh sách) | — |
| 23 | Loại truy vấn | Media query | Ngầm |
| 24 | Ai mở landmark | Navbar toàn cục mount ở locale root, trang không lặp | L1 |
| 25 | Overlay giá | Không nói; khẳng định "không có modal/drawer nào trong luồng này" | — |
| 26 | Cách nhận cây con | Dữ liệu đóng, không ReactNode | B13 |
| 27 | Sticky và offset | Dải chrome dính, offset dùng token riêng của trang (`--catalog-chrome-offset`) | L9 |

## Chấm

| # | Mục | Thật | Mù | Kết |
|---|---|---|---|---|
| 1 | Archetype | một cột, không sticky | sticky-top-chrome | LỆCH |
| 2 | Rail | không | không | TRÚNG |
| 3 | Thứ tự vùng | header→toolbar→owned→discover→pager | cùng thứ tự | TRÚNG |
| 4 | Vắng mặt vs null | slot vắng hẳn | không nói | THIẾU |
| 5 | header | breadcrumbs + h1 | tiêu đề + câu mô tả bịa thêm | LỆCH |
| 6 | toolbar | ô tìm + số kết quả cùng cụm | như vậy | TRÚNG |
| 7 | Công tắc lưới/danh sách | có | — | THIẾU |
| 8 | q và page | bộ nhớ | URL | KHÁC MÀ ĐƯỢC |
| 9 | view | localStorage | — | THIẾU |
| 10 | State cấp màn | 5, tách hai loại rỗng | 5, tách hai loại rỗng | TRÚNG |
| 11 | Điều kiện failed | error hoặc data null | error và chưa có data | TRÚNG |
| 12 | owned bỏ phiếu | không | không | TRÚNG |
| 13 | owned rỗng | ẩn vùng | ẩn vùng | TRÚNG |
| 14 | owner thẻ owned | khối khác hẳn | dùng chung | LỆCH |
| 15 | Loại khoá đã sở hữu | có | có | TRÚNG |
| 16 | Lọc ở đâu | frontend | bắt buộc backend | LỆCH (bản mù đúng về hệ quả: tổng sai và trang thủng) |
| 17 | Phân trang | slot cấp trang | trong run | LỆCH |
| 18 | Pager khi 1 trang | vẫn hiện | vắng mặt | LỆCH |
| 19 | restingCount | 3 | 9 | LỆCH |
| 20 | Page size | 9 | 9 | TRÚNG |
| 21 | Lưới hẹp | 1→2→3 | 3→2→1 | TRÚNG |
| 22 | Danh sách hẹp | không xếp lại | — | THIẾU |
| 23 | Loại truy vấn | viewport | media query | TRÚNG |
| 24 | Landmark | route layout | navbar ở root, trang không lặp | TRÚNG |
| 25 | Overlay giá | trang sở hữu | khẳng định không có | THIẾU |
| 26 | Nhận cây con | prop, không children | dữ liệu đóng | TRÚNG |
| 27 | Sticky/offset | không có sticky | dựng dải dính + token | LỆCH |

Điểm: 13/27 trúng (+1 khác mà được) · 8 lệch · 5 thiếu.

## Gate thiếu gì

- **Một dải điều khiển chỉ được dính đỉnh khi nội dung bên dưới dài hơn một màn VÀ điều khiển đó phải với tới được giữa chừng cuộn. Danh mục có phân trang thì mỗi trang vừa một màn, nên thanh điều khiển đi theo dòng chảy.** Gate đưa `sticky-top-chrome` ra như một archetype nhưng không cho điều kiện nào để CHỌN nó, nên bản mù chọn nhầm và kéo theo cả một token offset không tồn tại. — chữa mục 1 và 27.
- **Vùng tuỳ chọn phải VẮNG MẶT khỏi cây (không dựng slot), không phải slot chứa null.** Gate có B4 cho khối rỗng nhưng không có câu nào ở tầng layout cho slot vắng. — chữa mục 4.
- **Đầu trang của một trang trong cụm route là breadcrumbs + một tiêu đề, không kèm câu mô tả trừ khi nghiệp vụ nêu.** B5 cấm bịa field ở tầng khối; tầng vùng chưa có câu tương đương. — chữa mục 5.
- **Khi nghiệp vụ không nói trạng thái có đáng gửi đi hay không, đó là câu HỎI NGƯỢC người dùng, không phải chỗ để suy diễn.** Câu 3 của gate chỉ chạy được khi nghiệp vụ nói rõ; ở dashboard nghiệp vụ nói "chia sẻ được bằng đường dẫn" nên trả lời đúng, ở đây nghiệp vụ im nên trả lời trượt. — chữa mục 8.
- **Hai run trên cùng một trang, một run bán và một run đã sở hữu, KHÔNG dùng chung owner thẻ khi bộ control của chúng khác nhau hoàn toàn.** B6 nói "giống markup không đủ để gộp" nhưng không nói dấu hiệu nào bắt phải TÁCH; bản mù đọc B6 theo chiều gộp. — chữa mục 14.
- **Phân trang là điều khiển của TRANG khi nó điều khiển tham số của request cấp trang; nó chỉ thuộc run khi run tự sở hữu request.** B3 nói khối sở hữu presentation-state của mình, không phân biệt presentation-state với tham số request. — chữa mục 17.
- **Phân trang hiện ngay cả khi chỉ có một trang, để chiều cao trang không nhảy giữa các lần lọc.** Bản mù suy từ standing-offer ("control vắng mặt") mà standing-offer nói về control NGHIỆP VỤ, không về chrome điều hướng. — chữa mục 18.
- **restingCount là số hàng ĐIỂN HÌNH trong một lần trả về, không phải page size.** Ở đây page size 9 mà số thẻ nghỉ là 3, vì 9 ô nghỉ nói dối về độ dài và làm trang nhảy hai lần. — chữa mục 19.
- **Đổi lưới ↔ danh sách là trình bày: một component thẻ mang cả hai bố cục qua một prop, công tắc nằm ở thanh điều khiển của run, và lựa chọn được nhớ giữa các lần vào.** Gate không có một chữ nào về hai cách đọc cùng một tập. — chữa mục 7, 9, 22.
- **Chế độ danh sách không xếp lại khi hẹp: hàng vẫn là hàng, ảnh giữ bề ngang cố định.** — chữa mục 22.
- **Khối chỉ phát ý định mở overlay; overlay mount ở page owner như sibling của cây trang.** — chữa mục 25.
- **Lọc bỏ dữ liệu sau khi đã nhận một trang là một lỗi tổng-số-và-phân-trang, không phải một chi tiết dựng hình: query phải nhận danh tính người xem và tự trừ.** Bản mù nêu được điều này còn mã thật thì không; gate cần một câu bắt phải nêu nó thành yêu cầu backend. — chữa mục 16.

## Chỗ phải đoán

Nguyên văn trường `uncertain` của bản dựng mù:

- Gate không nói dải sticky nằm trên hay dưới tiêu đề trang, và có nuốt tiêu đề vào không. Tôi để tiêu đề cuộn đi và chỉ dính ô tìm + số đếm, để dải dính mỏng nhất.
- Gate không nói thứ tự hai section. Tôi đặt 'Khóa bạn đang học' TRÊN danh mục vì nó ngắn một hàng và là lối quay lại việc dở. Nếu founder coi màn này thuần bán hàng thì đảo lại.
- Gate không nói học viên đã đăng nhập mà chưa sở hữu khóa nào thì section 'đang học' rỗng hay biến mất. Tôi cho biến mất. B4 nói rỗng là state chứ không phải sự vắng mặt, nhưng B4 nói về khối đã có mặt trên màn; việc một vùng có tồn tại hay không là quyết định cấp layout. Chỗ này gate mơ hồ thật.
- Gate không nói ô tìm có áp lên section 'đang học' không. Tôi cho từ khóa CHỈ thu hẹp danh mục bán, vì 'biết còn bao nhiêu kết quả' và phân trang đều nói về danh mục. Nếu gõ mà mục đang học cũng đổi thì số kết quả sẽ mơ hồ.
- Gate không nói phân trang thuộc run hay là sibling của run. Tôi đặt trong run theo B3 (khối sở hữu presentation-state của mình), còn giá trị page thì ở URL do page owner nắm.
- Page size không có trong nghiệp vụ. Tôi chọn 9 (3×3) và lấy restingCount = 9 theo đó. Nếu backend cố định 12 hay 20 thì restingCount phải đổi theo, nếu không lưới sẽ nhảy chiều cao.
- Số lời hứa hiện trên mỗi thẻ không có trong nghiệp vụ. Tôi chọn 3 và clamp đều mọi thẻ để B7 giữ được. Backend có thể trả nhiều hơn.
- Gate không nói 'chưa bắt đầu / đang học / đã xong' có phải ba state riêng không. Tôi coi là ba sub-state của cùng standing-offer vì chỉ nhãn lối đi tiếp đổi, còn cấu trúc control không đổi. Nếu founder muốn 'đã xong' rụng luôn nút thì nó thành state thứ tư thật sự.
- Gate không nói lối đi tiếp cho trường hợp 'chưa có khóa nào được mở bán'. Tôi để page owner cấp và mặc định về trang chủ. Đây là quyết định sản phẩm, không suy ra được.
- Gate không nói ghi URL bằng push hay replace. Tôi chọn replace cho từ khóa (sau debounce) và push cho trang, để Back không lội qua từng ký tự.
- Gate không nói đổi trang có cuộn về đầu run không. Tôi chọn cuộn về đầu Vùng 4, không về đầu trang, để dải dính và ngữ cảnh tìm kiếm không bị mất.
- Gate không nói thẻ đã sở hữu có cần badge 'đã sở hữu' không. B2 cho phép vì đó là state thật, nhưng tên section cộng với thanh tiến độ đã nói đủ, nên tôi bỏ badge. Nếu sau này hai loại thẻ nằm chung một lưới thì badge thành bắt buộc.
- Gate không nói ảnh bìa tỉ lệ nào. Tôi giả định 16:9 cố định cho mọi thẻ vì B7 buộc các hàng thẳng cột.
- Route thật của màn (/courses hay /khoa-hoc) là suy đoán; tôi bị cấm đọc repo FE nên không xác nhận được, và cũng không xác nhận được navbar toàn cục có thật sự mount ở locale root như L1 mô tả hay không.
- Gate không nói có giới hạn số thẻ trong section 'đang học' khi học viên sở hữu nhiều khóa không, và nếu cắt thì 'xem tất cả' trỏ đi đâu. Tôi để không cắt, vì bịa ra một route riêng là bịa field cấp điều hướng.
- Gate không nói trạng thái 'page vượt quá tổng số trang' (ví dụ ai đó gửi link ?page=99). Tôi xếp nó vào empty của danh mục kèm lối về trang 1, nhưng đây là suy đoán.
