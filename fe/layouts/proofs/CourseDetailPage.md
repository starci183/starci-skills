---
id: fe-layouts-proof-course-detail-page
title: CourseDetailPage
slug: /fe/layouts/proofs/course-detail-page
sidebar_label: CourseDetailPage
description: Chấm bản dựng mù của trang chi tiết khóa học so với cấu trúc thật, và ghi lại những câu luật gate còn thiếu.
---

# CourseDetailPage

> Trang: course-details · Gate: layouts · Ngày: 2026-08-16

## Yêu cầu nghiệp vụ

Người chưa mua — và cả người đã ghi danh — mở trang của một khóa học cụ thể để quyết định có bỏ tiền học hay không, hoặc để quay lại đúng chỗ đang học dở. Trang phải nói đủ: khóa dạy gì và hứa những kết quả nào, đòi hỏi nền tảng gì trước khi vào, gồm bao nhiêu phần nội dung và ước chừng bao nhiêu giờ với bao nhiêu bài thử thách, đã có bao nhiêu người học cùng điểm đánh giá trung bình và nhận xét của họ, kèm những câu hỏi hay gặp do người ra khóa tự soạn. Giá hiển thị phải là con số chính người đang xem sẽ trả: có ưu đãi riêng cho người đó thì lấy ưu đãi riêng, không thì lấy giá của đợt mở bán đang chạy, kèm mức giảm so với giá gốc, số tiền tiết kiệm được, số suất còn lại nếu đợt đó có giới hạn, và cho xem cách tính giá đầy đủ khi họ muốn kiểm. Từ trang này người dùng mua ngay, học thử phần được mở miễn phí, hoặc cất khóa vào giỏ để trả tiền sau; người đã ghi danh thì không còn được chào mua nữa mà chỉ được đưa thẳng vào chỗ học, và người chưa đăng nhập bị đưa qua đăng nhập trước khi bất kỳ hành động tiền bạc nào chạy.

## Cấu trúc thật

| # | Mục | Sự thật | Neo |
|---|---|---|---|
| 1 | Archetype trang | `course-detail-page`: cột dọc gap-4, KHÔNG inset ngang, KHÔNG padding đáy. Ba slot: `navigation` (bắt buộc) → `body` (bắt buộc) → `action` (optional) | contracts/index.ts:2217 |
| 2 | Có rail không | Có, ở tầng `body`: archetype con `main-then-rail` | contracts/index.ts:2232 |
| 3 | Rail bên nào | Con cuối → bên phải, `w-80 shrink-0` | contracts/index.ts:2232 |
| 4 | Rail giữ gì | CHỈ khối chào giá (`course-pricing-rail`, host `aside`). Danh tính khóa (breadcrumbs, title, tagline) nằm trong `course-hero` ở CỘT CHÍNH | contracts/index.ts:2387,2244 |
| 5 | Điều hướng section trong trang | Có: `course-section-navigation`, host `nav`, 4 mục overview/curriculum/reviews/faq, chạy full-width | contracts/index.ts:2226 |
| 6 | Thanh hành động khi hẹp | Có: `course-mobile-action-bar`, sticky bottom-0 z-40, `md:hidden` | contracts/index.ts:2581 |
| 7 | Nội dung thanh đáy | Chỉ price + originalPrice + 1 CTA. Không giỏ, không học thử, không thang đợt giá | component.tsx:489 |
| 8 | Ai sở hữu thanh đáy | Một slot cấp TRANG với contract riêng, gọi `CourseMobileEnrollBar({...})`; không phải rail biến hình | component.tsx:489 |
| 9 | Ngưỡng hẹp | `md` = 768px, viewport media query, không container query nào trong trang này | contracts/index.ts:2232 |
| 10 | Rail khi rộng | `md:sticky` + `top-course-rail` + `self-start`; token riêng `--spacing-course-rail: 6.1rem` | globals.css:63 |
| 11 | Rail có vùng cuộn riêng | Có: `ScrollViewport` boundary `pricing-rail`, `max-height: calc((100dvh - var(--spacing-course-rail)) * 0.8)` | globals.css:64 · CoursePricingRail/component.tsx:194 |
| 12 | State cấp trang | 4: pending, ready, not-found, failed | component.tsx:192 |
| 13 | Retry | Chỉ `failed` có retry; `not-found` cố ý không, vì retry không đổi được câu trả lời | component.tsx:325 |
| 14 | not-found / failed vẽ gì | Thay TOÀN BỘ cây bằng một `EmptyNotice` | component.tsx:325 |
| 15 | Tư cách người xem | KHÔNG phải state cấp màn hình. Nó là dữ kiện nửa connected chốt rồi đổ vào props của rail | index.tsx:227 |
| 16 | Rail có thang state riêng | Có, độc lập với trang: ready, price-pending, adding, trialing, checking-out | index.tsx:268 |
| 17 | Pending theo hành động | Ba giá trị rời cho ba hành động (adding / trialing / checking-out); thanh đáy chỉ còn `price-pending` \| `ready` | index.tsx:268 |
| 18 | Thứ tự section thân | value props → prerequisites → modules → reviews → faqs | component.tsx:402 |
| 19 | Số liệu quy mô và bằng chứng | MỘT bảng `evidence` 6 ô nằm trong `course-hero`, trên các section | contracts/index.ts:2270,2277 |
| 20 | evidence lúc pending | Luôn đúng 6 ô (restingCount 6) nên lưới không nhảy khi số liệu về | contracts/index.ts:2277 |
| 21 | restingCount các list | stats 6 / promises 5 / modules 5 / prerequisites 3 / faqs 3 | component.tsx:211 |
| 22 | Nguồn restingCount | Đọc ngược từ `CONTRACTS`, không hardcode | component.tsx:211 |
| 23 | Cách tính giá đầy đủ | `CoursePriceOverlay`, mở bằng `isPriceDetailOpen` | index.tsx:328 |
| 24 | Ai sở hữu overlay giá | Nửa connected của TRANG; overlay nằm NGOÀI cây page, là sibling của `_CourseDetailPage` | index.tsx:328 |
| 25 | Cách nhận cây con | Prop, không children; host tag (nav/section/aside/ul/ol/li) do entry contract đặt, không do trang chọn | component.tsx:44 |
| 26 | Chặn đăng nhập | Ở nửa connected của trang, không trong khối chào giá | index.tsx:60 |
| 27 | Inset ngang của trang | Không có; nên thanh đáy chạm hai mép viewport | contracts/index.ts:2217,2582 |

## Bản dựng mù

| # | Mục | Bản mù | Căn cứ bản mù nêu |
|---|---|---|---|
| 1 | Archetype trang | `frame-with-identity`: rail + body, không có tầng nav và không có tầng action | Câu 7, loại ba archetype kia |
| 2 | Có rail không | Có | Câu 1 |
| 3 | Rail bên nào | Phải (nếu buộc phải chốt) | Mạch đọc đi trước, ô tiền cạnh nó |
| 4 | Rail giữ gì | Danh tính khóa (tên + một câu dạy gì) VÀ khối chào giá | frame-with-identity "rail giữ danh tính" |
| 5 | Điều hướng section | KHÔNG có: "không dựng section tabs, L3 và L4 không phát sinh nghĩa vụ" | Câu 2 (một mạch đọc duy nhất) |
| 6 | Thanh hành động khi hẹp | Có: khối chào giá rời rail thành thanh dính đáy | Mượn nhánh hẹp của frame-with-nav-rail |
| 7 | Nội dung thanh đáy | Con số phải trả + control chính | L8 (một field một vùng) |
| 8 | Ai sở hữu thanh đáy | CÙNG một owner ở hình thái hẹp, không phải bản sao | L8 |
| 9 | Ngưỡng hẹp | Không nói con số | — |
| 10 | Rail khi rộng | Dính, offset trừ chrome của chính trang này bằng token riêng | L9 |
| 11 | Rail có vùng cuộn riêng | Không nói | — |
| 12 | State cấp trang | auth-unresolved, course-pending, course-failed, course-not-found, ready-guest, ready-member-unenrolled, ready-enrolled | Câu 6 |
| 13 | Retry | Không nói chính sách retry | — |
| 14 | not-found / failed vẽ gì | Không nói vẽ thay cả cây | — |
| 15 | Tư cách người xem | Là ba state cấp màn hình | Câu 6 |
| 16 | Rail có thang state riêng | Có: khối chào giá tự settle, page ready vẫn có offer pending | Thang state chuẩn |
| 17 | Pending theo hành động | buy-pending, cart-pending, trial-pending, continue-pending | B11 |
| 18 | Thứ tự section thân | outcomes → prerequisites → contents → reviews → faq | Câu 5 |
| 19 | Số liệu quy mô và bằng chứng | 3 standing-figure (phần/giờ/thử thách) cạnh khối nội dung + 2 standing-figure (người học/điểm) cạnh nhận xét | Archetype standing-figure |
| 20 | evidence lúc pending | Không nói | — |
| 21 | restingCount các list | outcomes 4 / prerequisites 3 / contents 5 / reviews 3 / faq 4 | Tự đoán |
| 22 | Nguồn restingCount | Không nói | — |
| 23 | Cách tính giá đầy đủ | Tiết lộ tại chỗ, thẳng hàng với trigger (B7); nếu thành overlay thì trong overlay không dựng card | B7, L6 |
| 24 | Ai sở hữu overlay giá | Khối chào giá tự giữ đóng/mở | B3 |
| 25 | Cách nhận cây con | Dữ liệu đóng, không ReactNode, không children | B13 |
| 26 | Chặn đăng nhập | Ngoài khối chào giá, ở chủ sở hữu hành động cấp trang | Tái dùng khối |
| 27 | Inset ngang của trang | Không nói | — |

## Chấm

| # | Mục | Thật | Mù | Kết |
|---|---|---|---|---|
| 1 | Archetype | nav → body(main-then-rail) → action | rail + body | LỆCH |
| 2 | Rail | có | có | TRÚNG |
| 3 | Rail bên nào | phải | phải | TRÚNG |
| 4 | Rail giữ gì | chỉ chào giá | danh tính + chào giá | LỆCH |
| 5 | Điều hướng section | có, sticky dưới navbar | khẳng định không có | THIẾU |
| 6 | Thanh đáy khi hẹp | có | có | TRÚNG |
| 7 | Nội dung thanh đáy | giá + gốc + 1 CTA | giá + 1 control | TRÚNG |
| 8 | Owner thanh đáy | contract riêng cấp trang | rail biến hình | LỆCH |
| 9 | Ngưỡng hẹp | md 768px | — | THIẾU |
| 10 | Rail dính + token riêng | có | có | TRÚNG |
| 11 | Vùng cuộn trong rail | có, dvh | — | THIẾU |
| 12 | State cấp trang | 4 bậc, có not-found riêng | 4 bậc đó nằm trong 7 | TRÚNG |
| 13 | Retry | chỉ failed | — | THIẾU |
| 14 | Thay cả cây | có | — | THIẾU |
| 15 | Tư cách người xem | dữ kiện của rail | state cấp màn hình | LỆCH |
| 16 | Rail thang state riêng | có | có | TRÚNG |
| 17 | Pending theo hành động | 3 giá trị rời | 4 pending owner | TRÚNG |
| 18 | Thứ tự section | 5, đúng thứ tự | 5, đúng thứ tự | TRÚNG |
| 19 | Bảng số liệu | 1 bảng 6 ô trong hero | 5 figure rải hai chỗ | LỆCH |
| 20 | evidence lúc pending | luôn 6 ô | — | THIẾU |
| 21 | restingCount | 6/5/5/3/3 | 4/3/5/3/4 | LỆCH |
| 22 | Nguồn restingCount | đọc từ contract | — | THIẾU |
| 23 | Cách tính giá | overlay | inline (có nêu overlay là lựa chọn) | KHÁC MÀ ĐƯỢC |
| 24 | Owner overlay | nửa connected của trang | khối | LỆCH |
| 25 | Nhận cây con | prop, host do contract đặt | dữ liệu đóng | TRÚNG |
| 26 | Chặn đăng nhập | ngoài khối | ngoài khối | TRÚNG |
| 27 | Inset ngang | không có | — | THIẾU |

Điểm: 11/27 trúng (+1 khác mà được) · 7 lệch · 8 thiếu.

## Gate thiếu gì

- **Một trang được phép mang NHIỀU tầng archetype cùng lúc: một dải dính đỉnh, một thân rail-and-main, và một thanh dính đáy là ba tầng của cùng một trang, không phải ba archetype loại trừ nhau.** Gate bắt chọn đúng một trong bốn, nên bản mù chọn `frame-with-identity` rồi mất luôn tầng nav và tầng action. — chữa mục 1.
- **Rail của một trang thương mại giữ CAM KẾT, không giữ danh tính. Danh tính của đối tượng nằm ở đầu cột chính, nơi mạch đọc bắt đầu.** Gate mô tả `frame-with-identity` là "rail giữ danh tính" mà không nói khi nào rail giữ hành động thay vì danh tính. — chữa mục 4.
- **Một trang dài có nhiều đoạn phải có điều hướng nội trang; nó là tầng hai của navbar (dính liền, sticky) và nó chỉ CUỘN tới đoạn chứ không ẩn đoạn nào.** Gate có L3 và L4 nói về tab, nhưng câu 2 ("mode hay bước") dẫn bản mù tới kết luận "không có mode nên không có tab", trong khi thứ đang thiếu là một loại thứ ba: neo cuộn. — chữa mục 5.
- **Thanh dính đáy ở khổ hẹp là một contract riêng của TRANG, không phải rail đổi hình.** Nó chọn ra một tập con của rail và bỏ phần còn lại, nên nó có tập slot riêng và phải khai riêng. — chữa mục 8.
- **Tư cách người xem với đối tượng (đã mua hay chưa) là DỮ KIỆN mà nửa connected chốt rồi đổ vào props, không phải một state cấp màn hình.** State cấp màn hình chỉ dành cho thứ quyết định trang có tồn tại hay không. — chữa mục 15.
- **Các con số quy mô và bằng chứng của một đối tượng đứng chung MỘT bảng có số ô cố định, ngay dưới danh tính; không rải thành nhiều standing-figure cạnh các đoạn liên quan.** Số ô cố định để lưới không nhảy khi số liệu về. — chữa mục 19 và 20.
- **restingCount khai ở contract và khối đọc ngược từ contract; con số không được xuất hiện trong mã khối.** Gate chỉ nói "slot repeats kèm restingCount" mà không nói ai giữ con số. — chữa mục 21 và 22.
- **Overlay giải thích một con số thuộc nửa connected của trang, không thuộc khối phát ra yêu cầu; khối chỉ báo cáo ý định.** — chữa mục 24.
- **Khi rail dính, khai luôn ngưỡng, token offset và giới hạn chiều cao của vùng cuộn trong rail.** L9 chỉ nói offset; không nói tới việc rail dài hơn viewport thì phải tự cuộn. — chữa mục 9 và 11.
- **failed và not-found thay TOÀN BỘ cây trang; chỉ failed được retry, not-found không, vì hỏi lại không đổi câu trả lời.** Thang state chuẩn không nói state hỏng vẽ ở đâu và có được retry hay không. — chữa mục 13 và 14.
- **Trang có thanh dính đáy chạm hai mép thì trang không có inset ngang; inset thuộc từng vùng.** — chữa mục 27.

## Chỗ phải đoán

Nguyên văn trường `uncertain` của bản dựng mù:

- Gate nói 'rail chứa thứ ĐỨNG YÊN trong khi body ĐỔI' nhưng không nói cuộn có tính là 'body đổi' hay không. Ở màn này body chỉ đổi bằng cuộn chứ không đổi bằng mode. Tôi coi cuộn là đủ để có rail. Nếu 'đổi' bắt buộc phải là đổi panel/route thì màn này không có rail và phải rơi về một cột duy nhất + sticky-top-chrome, với khối chào giá là sibling dính — cấu trúc khối bên dưới giữ nguyên, chỉ layout đổi.
- frame-with-identity được mô tả là 'rail giữ DANH TÍNH'. Gate không nói rail đó có được chứa một khối HÀNH ĐỘNG (giá + nút mua) hay không. Tôi đặt khối chào giá vào rail vì nó là thứ đứng yên thứ hai; nếu luật thật là 'rail chỉ chứa danh tính' thì khối chào giá phải xuống body và trang mất chỗ neo quyết định.
- Gate cho luật hẹp của frame-with-nav-rail (thanh đáy hoặc xếp dọc) nhưng KHÔNG cho luật hẹp của frame-with-identity. Tôi mượn 'thanh đáy' cho khối chào giá và 'xếp dọc' cho phần còn lại. Đây là suy luận bắc cầu, không phải điều gate nói.
- Trang một-đối-tượng: gate cho thang state theo 'data rỗng → empty', nhưng không nói 'khóa học không tồn tại' là empty hay là failed hay là một tầng route riêng. Tôi xếp nó vào empty.
- standing-figure được định nghĩa CHỈ ba state và 'không có failed riêng', trong khi thang state chuẩn của khối có dữ liệu lại có failed. Số người đã học và điểm trung bình là dữ liệu đọc được và đọc được thì hỏng được. Tôi giải bằng cách: lượt đọc hỏng thì figure hiện empty. Đây là mâu thuẫn thật giữa hai mục của gate, không phải chỗ tôi thiếu thông tin — nên ghi lại để sửa gate.
- Gate không cho con số nào cho restingCount. Toàn bộ 4 / 3 / 5 / 3 / 4 là tôi đoán theo cảm giác về chiều cao nghỉ hợp lý, không phải theo luật.
- Gate không nói ba con số quy mô (số phần / số giờ / số bài thử thách) là MỘT khối chứa ba field hay BA khối standing-figure cạnh nhau. Tôi chọn ba khối sibling; nếu là một khối thì B1 buộc chỉ một surface cho cả ba và bản vẽ khác hẳn.
- Nghiệp vụ nói 'người chưa đăng nhập bị đưa qua đăng nhập trước khi bất kỳ hành động TIỀN BẠC nào chạy'. Học thử phần miễn phí không phải hành động tiền bạc, nên tôi cho nó chạy không cần đăng nhập. Nếu học thử cần ghi tiến độ thì nó cũng phải chặn — nghiệp vụ và gate đều không nói.
- Số suất còn lại bằng 0: nghiệp vụ chỉ nói 'hiện số suất còn lại nếu đợt có giới hạn', không nói hết suất thì sao. Tôi KHÔNG bịa state sold-out (B5); tôi giả định đợt hết suất thì không còn là 'đợt đang chạy' và báo giá tự rơi về mức tiếp theo. Nếu thật ra cần một state hết-suất thì đó là một control rụng nữa của standing-offer và phải khai thêm.
- Khóa giá 0 đồng / khóa miễn phí hoàn toàn: nghiệp vụ không nhắc, tôi không vẽ. Nếu tồn tại thì bộ control của standing-offer còn một nhánh nữa.
- Ai sở hữu việc chặn-đăng-nhập: gate không nói. Tôi đặt ngoài khối chào giá (chủ sở hữu hành động cấp trang) để khối còn tái dùng được. Đặt trong khối cũng không vi phạm điều nào tôi đọc được.
- B11 nói 'mỗi action một pending owner riêng' nhưng không nói lỗi của từng action nằm ở đâu. Tôi cho mỗi action một chỗ báo lỗi riêng theo cùng tinh thần; gate không xác nhận.
- Bảng cách tính giá đi chung payload báo giá hay là lượt đọc thứ hai: gate không nói, đây là quyết định của tôi dựa trên lý do 'bảng để KIỂM thì không được lệch nguồn'.
- Khóa cache của báo giá phải mang danh tính người xem (để guest và thành viên không dùng chung ưu đãi riêng): gate được cấp không nói gì về cache/khóa dữ liệu. Đây là quyết định ngoài gate.
- Neo tới từng phần trong body (hash/anchor) là URL state hay bộ nhớ: câu 3 của gate chỉ có hai ô 'URL hay bộ nhớ' và không xử lý anchor. Tôi coi anchor là điều hướng trong trang, không phải state.
- Gate được cấp không có B9 và B12 — có thể bản đầy đủ có, và có thể chúng ràng buộc đúng những chỗ tôi vừa phải đoán.
- Rail bên trái hay bên phải: gate không nói một chữ nào. Tôi cố ý KHÔNG chốt trong bản dựng; nếu buộc phải chốt thì tôi chọn rail phải cho khối chào giá, vì mạch đọc để phán xét đi trước và ô tiền đứng cạnh nó, nhưng đó là thẩm mỹ chứ không phải suy ra từ luật.
- Không đọc bất kỳ file nào trong starci-academy-fe / starci-academy, không grep, không web. Bản dựng này chỉ đến từ yêu cầu nghiệp vụ và bộ gate dán trong prompt; mọi trùng khớp với màn thật là do luật, hoặc do may.
