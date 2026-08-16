---
id: fe-blocks-proof-course-pricing-rail
title: CoursePricingRail
slug: /gates/blocks/proofs/course-pricing-rail
sidebar_label: CoursePricingRail
description: Chấm bản dựng mù của khối chào giá trên trang khóa học so với cấu trúc thật, và ghi lại những câu luật gate còn thiếu.
---

# CoursePricingRail

> Trang: course-details · Gate: blocks · Ngày: 2026-08-16

## Yêu cầu nghiệp vụ

Người vào đây là khách chưa đăng nhập hoặc học viên đang cân nhắc một khóa học cụ thể, và việc họ cần làm là quyết định có bỏ tiền ra hay không ngay tại trang giới thiệu khóa đó, không phải đi tìm nơi khác để xem giá. Chỗ này phải nói đủ mọi dữ kiện thương mại của khóa: ảnh khóa học, số tiền thực trả sau khi đã trừ ưu đãi riêng của người xem, giá gốc, mức giảm, số tiền tiết kiệm được cùng lối mở phần giải thích giá do hệ thống tính, đợt bán đang mở và còn bao nhiêu suất, bảng giá của toàn bộ các đợt để người xem thấy chờ thêm thì đắt lên bao nhiêu, và số người đã ghi danh làm bằng chứng. Ràng buộc nghiệp vụ: người đã ghi danh thì chỉ được mời học tiếp chứ không mời mua, không mời học thử và không được bỏ vào giỏ; khóa miễn phí không có giỏ hàng; giá riêng của người xem có thể còn đang tính nên chưa được phép hiện một con số tạm rồi đổi số khác ngay sau đó; và người xem phải chọn dứt khoát giữa mua trọn khóa hay chỉ xem thử phần mở, hai lối đó không được bày cùng lúc để tranh nhau.

## Cấu trúc thật

| # | Mục | Sự thật | Neo |
|---|---|---|---|
| 1 | Hình khối | Một block pure duy nhất, KHÔNG có twin (thư mục chỉ có `component.tsx` + `component.test.tsx`). Cặp export là `_CoursePricingRail` + projection cùng key, không phải pure/connected. Khối CÓ `useState` | component.tsx:136,319 |
| 2 | Ai vẽ surface | Khối TỰ vẽ: render `ScrollViewport(boundary="pricing-rail")`, branch đó bọc `SurfaceCard` ở contract `pricing-rail-scroll-viewport`. Nơi gọi không cấp surface | component.tsx:193 · branches/ScrollViewport/index.tsx:28 |
| 3 | Tự gọi request | KHÔNG. Không SWR, không fetch. Mọi request nằm ở nửa connected của TRANG | component.tsx:137 · CourseDetailPage/index.tsx:72 |
| 4 | i18n và định dạng tiền | Không dùng i18n hook; mọi chuỗi đến đã dịch và mọi số tiền đã format sẵn | component.tsx:137 |
| 5 | Nội dung khối | 8 mục: phase badge, cover, price block, selector, purchase intent, exploration intent, ladder, proof | contracts/index.ts:2387 |
| 6 | Thứ tự | badge → cover → giá (gồm scarcity trong cùng khối giá) → selector → purchase → exploration → ladder → proof | contracts/index.ts:2387 |
| 7 | Badge đợt | Là Badge con đầu tiên nên contract kéo `absolute` lên góc phải trên của ảnh bìa | contracts/index.ts:2390 |
| 8 | Hai làn mua/học thử | `ChoiceTabs` + đúng một nhánh tồn tại trong DOM; test khẳng định nhánh kia biến mất | component.tsx:144 · component.test.tsx:42 |
| 9 | Làn mặc định | `selectedIntent` useState mặc định `"purchase"` | component.tsx:137 |
| 10 | Mode ở đâu | Bộ nhớ của khối; nơi gọi KHÔNG điều khiển được và cũng không nhận báo về | component.tsx:137 |
| 11 | Khi nào có bộ chọn | `hasIntentSwitch` chỉ khi có cả `trialLabel` lẫn intent copy; thiếu một trong hai thì khoá cứng `purchase` | component.tsx:144 |
| 12 | Thang state | 5 giá trị union: ready \| price-pending \| adding \| trialing \| checking-out | component.tsx:119 |
| 13 | price-pending vẽ gì | Chỉ ô giá nghỉ; ẩn original + discount + CẢ cụm note; scarcity, ladder, nút, proof vẫn hiện | component.tsx:140 |
| 14 | empty / error / disabled | KHÔNG có state nào trong ba loại đó | component.tsx:119 |
| 15 | Hỏng thì ai xử | Tầng trang: `failed`/`not-found` thay THẾ toàn trang bằng một notice, rail không tồn tại lúc đó | CourseDetailPage/component.tsx:330 |
| 16 | Slot lặp | KHÔNG có slot `repeats` nào trong toàn bộ cây contract, do đó không có `restingCount` nào để đọc | contracts/index.ts:2403 |
| 17 | Bảng đợt giá | MỘT leaf `pricing-phase-disclosure` nhận mảng `phases` và tự map bên trong; không phải danh sách có state | leaves/PricingPhaseDisclosure/index.tsx:47 |
| 18 | Đợt đang mở và suất | Badge trong khối giá (`scarcity` tone warning, `phase` tone accent), không có thang state riêng | contracts/index.ts:2408 |
| 19 | Số người ghi danh | Leaf text size xs, optional; không thang state | contracts/index.ts:2387 |
| 20 | Mức giảm | Badge tone success (contract `price-discount-line` đã khoá, dùng chung 5 nơi) | contracts/index.ts:1449 |
| 21 | Suất còn lại | Badge tone warning | component.tsx:149 |
| 22 | Nút và pending | primary md icon next trailing, cart secondary md, trial tertiary md; mỗi state pending dính đúng một nút | component.tsx:200 · component.test.tsx:150 |
| 23 | Giỏ khi miễn phí / đã ghi danh | Tầng gọi bỏ `cartLabel` nên khối không vẽ nút giỏ | CourseDetailPage/index.tsx:227 |
| 24 | Đã ghi danh | `ctaLabel` continue; trial và cart bị bỏ | CourseDetailPage/index.tsx:227 |
| 25 | Thanh đáy khi hẹp: nội dung | price + originalPrice + 1 CTA, dùng chung `act` | CourseDetailPage/component.tsx:489 |
| 26 | Thanh đáy: ai sở hữu | `CourseMobileEnrollBar` — component và contract RIÊNG ở cấp trang, không phải rail biến hình | contracts/index.ts:2581 |
| 27 | Bề rộng và sticky | `main-then-rail` đặt `w-80 shrink-0 sticky top-course-rail` từ md; khối không tự đặt | contracts/index.ts:2232 |
| 28 | Vùng cuộn trong khối | `max-height: calc((100dvh - var(--spacing-course-rail)) * 0.8)` | globals.css:64 |
| 29 | Khoảng trống đã biết | Pending của TRANG không đổ xuống: nơi gọi truyền `railState ?? "ready"` và props rỗng, nên lúc trang pending rail vẽ `ready` với chuỗi rỗng | CourseDetailPage/component.tsx:478 |
| 30 | Cách nhận nội dung | Prop, không children; `isInCart` là prop CHẾT, không được đọc ở đâu | component.tsx:101 |

## Bản dựng mù

| # | Mục | Bản mù | Căn cứ bản mù nêu |
|---|---|---|---|
| 1 | Hình khối | Vỏ panel là `seating-plan` (không request, không state, không twin) + các khối con riêng | Câu 7 |
| 2 | Ai vẽ surface | Panel là surface owner duy nhất, các khối con là hàng bên trong | B1 |
| 3 | Tự gọi request | Không; page owner gọi một lượt và truyền xuống, vì hai làn dùng chung payload | Câu 4 |
| 4 | i18n và định dạng tiền | Không nói về i18n nhưng khai "nhận dữ liệu đóng đã có kiểu" | B13 |
| 5 | Nội dung khối | Ảnh, nhóm tiền (thực trả, gốc, giảm, tiết kiệm, lối mở giải thích), đợt đang mở + suất, bảng giá các đợt, số người ghi danh, làn hành động | Câu 1 |
| 6 | Thứ tự | ảnh → tiền → làn hành động → đợt + suất → số người → bảng giá | Tự sắp |
| 7 | Badge đợt | Không nói là badge đè lên ảnh | — |
| 8 | Hai làn mua/học thử | MODE loại trừ trong cùng một standing-offer; đúng một làn được mount, làn kia vắng mặt | Câu 2 |
| 9 | Làn mặc định | Mua, khi khóa còn mua được | Tự quyết |
| 10 | Mode ở đâu | Bộ nhớ, KHÔNG lên URL vì nó phái sinh từ tư cách người xem | Câu 3 |
| 11 | Khi nào có bộ chọn | Bộ chọn vắng mặt khi chỉ còn một làn tồn tại | standing-offer |
| 12 | Thang state | Mỗi cụm một thang riêng: nhóm tiền có pending/ready-có-ưu-đãi/ready-không/free/owned/failed; bảng giá 4 state; hai standing-figure ba state | Thang state chuẩn |
| 13 | price-pending vẽ gì | KHÔNG vẽ bất kỳ chữ số tiền nào, kể cả giá gốc đứng thay | Nghiệp vụ "không hiện số tạm" |
| 14 | empty / error / disabled | Có `failed` cho nhóm tiền và cho bảng giá; `unavailable` khi hết đợt | Thang state chuẩn |
| 15 | Hỏng thì ai xử | Không nói | — |
| 16 | Slot lặp | Bảng giá là named-run, `repeats: true`, `restingCount: 3` | named-run |
| 17 | Bảng đợt giá | Danh sách có tên, mỗi hàng một đợt, đủ bốn state | named-run |
| 18 | Đợt đang mở và suất | `standing-figure` riêng, ba state | standing-figure |
| 19 | Số người ghi danh | `standing-figure` riêng, ba state | standing-figure |
| 20 | Mức giảm | Một chip duy nhất (tự nhận là chỗ chọn thay gate) | B2 |
| 21 | Suất còn lại | Chip, vì nói về điều kiện thời điểm | B2 |
| 22 | Nút và pending | Đúng một control cam kết mỗi làn; mỗi control một pending owner riêng | B11 |
| 23 | Giỏ khi miễn phí / đã ghi danh | Vắng mặt, không disabled | standing-offer |
| 24 | Đã ghi danh | Chỉ còn control học tiếp; mua/giỏ/học thử/bộ chọn đều vắng | Nghiệp vụ |
| 25 | Thanh đáy khi hẹp: nội dung | Số tiền thực trả + đúng một control cam kết | Câu 5 |
| 26 | Thanh đáy: ai sở hữu | CÙNG owner ở hình thái hẹp, "không phải bản sao thứ hai của cùng field" | L8 |
| 27 | Bề rộng và sticky | Bề rộng thuộc layout owner; rail dính, offset token riêng của trang | L9, L10 |
| 28 | Vùng cuộn trong khối | Không nói | — |
| 29 | Khoảng trống pending | Không nói | — |
| 30 | Cách nhận nội dung | Dữ liệu đóng, không ReactNode | B13 |

## Chấm

| # | Mục | Thật | Mù | Kết |
|---|---|---|---|---|
| 1 | Hình khối | một block có state, không twin | vỏ seating-plan + khối con | LỆCH |
| 2 | Ai vẽ surface | khối tự vẽ, đúng một | panel là surface owner duy nhất | TRÚNG |
| 3 | Tự gọi request | không | không, page gọi một lượt | TRÚNG |
| 4 | Chuỗi và tiền đã chốt sẵn | có | dữ liệu đóng | TRÚNG |
| 5 | Nội dung khối | 8 mục | cùng 8 mục | TRÚNG |
| 6 | Thứ tự | scarcity trong khối giá, ladder trước proof | hành động chen giữa | LỆCH |
| 7 | Badge đợt đè ảnh | có | — | THIẾU |
| 8 | Hai làn loại trừ | có | có | TRÚNG |
| 9 | Làn mặc định | purchase | mua | TRÚNG |
| 10 | Mode ở bộ nhớ | có | có | TRÚNG |
| 11 | Điều kiện có bộ chọn | cần trialLabel + copy | khi còn hai làn | TRÚNG |
| 12 | Thang state | một union 5 giá trị cho cả khối | nhiều thang rời theo cụm | LỆCH |
| 13 | price-pending | chỉ ô giá nghỉ, giữ scarcity | không vẽ số tiền nào | TRÚNG |
| 14 | empty/error/disabled | không có | có failed và unavailable | LỆCH |
| 15 | Hỏng do trang xử | thay cả trang | — | THIẾU |
| 16 | Slot lặp | không có slot lặp nào | bảng giá repeats restingCount 3 | LỆCH |
| 17 | Bảng đợt giá | một leaf nhận mảng | named-run 4 state | LỆCH |
| 18 | Đợt/suất | badge trong khối giá | standing-figure riêng | LỆCH |
| 19 | Số người ghi danh | text xs optional | standing-figure riêng | LỆCH |
| 20 | Mức giảm | badge success | chip | TRÚNG |
| 21 | Suất còn lại | badge warning | chip | TRÚNG |
| 22 | Nút và pending | 3 nút, pending đúng một nút | pending owner riêng mỗi control | TRÚNG |
| 23 | Giỏ khi miễn phí/đã ghi danh | không vẽ | vắng mặt | TRÚNG |
| 24 | Đã ghi danh | chỉ học tiếp | chỉ học tiếp | TRÚNG |
| 25 | Thanh đáy: nội dung | giá + gốc + 1 CTA | giá + 1 control | TRÚNG |
| 26 | Thanh đáy: owner | component + contract riêng | cùng owner biến hình | LỆCH |
| 27 | Bề rộng và sticky | w-80 sticky do archetype cha | thuộc layout owner, dính, token riêng | TRÚNG |
| 28 | Vùng cuộn trong khối | có, dvh | — | THIẾU |
| 29 | Pending của trang không đổ xuống | có khoảng trống | — | THIẾU |
| 30 | Nhận nội dung | prop, không children | dữ liệu đóng | TRÚNG |

Điểm: 17/30 trúng · 9 lệch · 4 thiếu.

## Gate thiếu gì

- **Một cụm thương mại là MỘT khối có một thang state duy nhất, không phải một vỏ `seating-plan` chứa nhiều khối con mỗi cái một thang.** Gate cho `seating-plan` cái quyền "chỉ sở hữu đường nối" mà không nói khi nào một vùng là một khối trọn vẹn; hệ quả dây chuyền là năm dòng LỆCH (12, 16, 17, 18, 19). — chữa mục 1 và 12.
- **Chỉ cụm nào tự đọc dữ liệu mới có thang state. Một cụm chỉ nhận chuỗi đã chốt thì hình dạng của nó là SLOT CÓ hay SLOT VẮNG, không phải pending/empty/failed.** Đây là câu luật đắt nhất trong cả bộ chấm này: bản mù rải bốn thang state lên bốn cụm chỉ nhận prop. — chữa mục 14, 17, 18, 19.
- **Một danh sách ngắn, cố định, không có state riêng thì là MỘT leaf nhận mảng, không phải một `named-run`.** `named-run` dành cho danh sách tự đọc dữ liệu. Không có slot lặp thì không có restingCount, và ép một restingCount vào là bịa một trạng thái nghỉ không tồn tại. — chữa mục 16 và 17.
- **Nửa connected của trang chốt mọi chuỗi và mọi số tiền; khối chào giá không import i18n và không tự định dạng tiền.** Bản mù trúng bằng B13 chứ không bằng một câu nói thẳng; ba khối trong bộ này đều theo luật đó. — củng cố mục 4.
- **Thanh dính đáy ở khổ hẹp là một component và một contract RIÊNG ở cấp trang, mang một tập con của rail.** Bản mù đọc L8 thành "cùng owner biến hình" và vì thế không khai được rằng thanh đáy chỉ giữ 3 trường trong 8. — chữa mục 26.
- **Khối nào tự vẽ surface thì phải khai luôn giới hạn chiều cao và vùng cuộn của nó khi nó dính.** — chữa mục 7, 28.
- **Trạng thái pending của trang phải ánh xạ xuống trạng thái nghỉ của khối; truyền chuỗi rỗng với state `ready` là vẽ một khối ready rỗng ruột.** Thang state chuẩn chỉ mô tả một tầng; không có câu nào về việc nối hai tầng. — chữa mục 29.
- **Thứ tự trong một khối chào giá: bằng chứng khan hiếm đứng NGAY trong khối giá (nó định phẩm con số), còn bảng so sánh và bằng chứng xã hội đứng SAU hành động.** B8 nói nhóm ngữ nghĩa trước gap sau nhưng không cho thứ tự giữa các nhóm. — chữa mục 6.
- **Prop khai mà không đọc là một prop chết và là một lỗi, không phải một chi tiết.** (`isInCart`) — không thuộc phần bản mù đoán được, nhưng gate cũng không có câu nào bắt kiểm.

## Chỗ phải đoán

Nguyên văn trường `uncertain` của bản dựng mù:

- Rail nằm bên phải hay bên trái: gate không nói. Tôi chọn PHẢI, thuần theo quy ước đọc trái-sang-phải cho vùng cam kết. Không có gì trong gate ủng hộ hay bác bỏ.
- Rail chỉ hợp lệ khi thân trang có thứ đổi. Yêu cầu không nêu nội dung thân trang nào cả. Tôi ĐOÁN rằng trang giới thiệu khóa có một thân dài cuộn được (mô tả, nội dung học, giảng viên). Nếu thân thực ra ngắn và tĩnh, luật gốc nói KHÔNG có rail, và cấu trúc đúng sẽ là một khối chào bán trong dòng chảy.
- frame-with-identity hay sticky-top-chrome: gate không cho tiêu chí phân định khi thứ đứng yên vừa mang danh tính vừa mang hành động. Tôi chọn frame-with-identity vì layout phải mang state cấp màn hình (tư cách người xem, miễn phí/có phí).
- Gate chỉ nêu cách hẹp lại cho frame-with-nav-rail (thanh đáy hoặc xếp dọc). frame-with-identity không có nhánh hẹp. Tôi mượn nguyên tắc đó và chọn thanh dính ĐÁY, cũng như ngưỡng breakpoint thì gate hoàn toàn không nói.
- MÂU THUẪN THẬT trong gate: standing-figure nói 'không có failed riêng', nhưng thang state chuẩn nói 'có error VÀ chưa từng có data → failed'. Với số suất còn lại và số người ghi danh tôi chọn giữ ở hình thái pending khi lỗi, vì hiện sai số nguy hiểm hơn không hiện. Đây là tôi tự xử, gate không phân xử.
- standing-offer nói 'control VẮNG MẶT chứ không disabled', còn thang state nói pending là cây ready với isLoading. Khi giá riêng đang tính thì control mua nên VẮNG MẶT hay TỒN TẠI ở dạng đang tải? Tôi chọn: sự tồn tại của control do state NGHIỆP VỤ quyết, còn pending chỉ đổi hình thái. Gate không nói vế nào thắng.
- Người đã ghi danh có còn được thấy nhóm tiền và bảng giá các đợt không? Nghiệp vụ chỉ nói 'không mời mua', không nói 'giấu giá'. Tôi chọn ẩn cả nhóm tiền lẫn bảng giá và chỉ giữ số người ghi danh. Đây là suy diễn.
- Khi không có đợt nào đang mở hoặc hết suất: còn mua được cho đợt kế tiếp không? Yêu cầu không nói. Tôi chọn control cam kết vắng mặt và bảng giá vẫn cho thấy đợt kế tiếp.
- Ai quyết làn mặc định giữa mua và học thử, và có nhớ lựa chọn giữa các lần vào không? Tôi chọn mặc định làn mua khi khóa còn mua được, và mode sống trong bộ nhớ chứ không vào URL. Gate không có luật cho state phụ thuộc tư cách người xem trong URL.
- restingCount của bảng giá các đợt: gate bắt phải có số nhưng không cho số. Tôi chọn 3.
- Mức giảm là chip hay chữ (B2). Tôi chọn MỘT chip duy nhất vì 'đang có ưu đãi' đọc như một state thật. Nếu mức giảm chỉ là phép trừ suy ra từ hai con số thì theo B2 nó phải là chữ, và chỗ này tôi đang chọn thay cho gate.
- Ảnh khóa học không khớp archetype khối nào: nó không phải một nhãn một giá trị, không phải danh sách, không phải bàn ghế. Tôi coi nó là field danh tính do rail sở hữu, và khi không có ảnh thì KHÔNG bịa placeholder (B5) — nhưng gate không nói gì về media identity.
- Mode cấp khối và tab cấp trang: gate chỉ định nghĩa tab ở tầng navbar (L3/L4). Mua-hay-học-thử là mode BÊN TRONG một khối. Tôi tự phân tầng như vậy; gate không có luật cho mode cấp khối.
- Khóa miễn phí có đợt bán và suất không? Không rõ. Tôi chọn: nếu có dữ liệu thì vẫn vẽ, nếu không thì state empty.
- Khách chưa đăng nhập có 'ưu đãi riêng' không? Tôi giả định không, nên với khách các dòng giá gốc và tiết kiệm vắng mặt (B5) chứ không hiện 'tiết kiệm 0đ'.
- 'Mức giảm' và 'số tiền tiết kiệm' là hai field backend riêng hay suy ra từ giá gốc trừ thực trả — không rõ. Tôi giả định chúng nằm trong payload giá; nếu không có thì theo B5 chúng không được vẽ.
- Hết suất (0 suất) là state empty hay settled-với-giá-trị-0. Tôi chọn settled-0 cho con số, và chính nó đẩy làn hành động sang unavailable.
- Giỏ hàng là một control trong làn mua hay một hành động cấp trang khác. Tôi chọn control trong làn mua.
- Ai gọi dữ liệu: page owner hay panel. B3 chỉ nói khối sở hữu trình bày, không nói ai fetch. Tôi chọn page owner gọi một lượt và truyền dữ liệu đóng xuống.
- Giải thích giá mở inline hay overlay. Tôi chọn inline ở khổ rộng và overlay ở khổ hẹp; gate chỉ ràng buộc rằng overlay không được chứa card (L6), không nói nên dùng cái nào.
- Yêu cầu nói 'trang giới thiệu khóa' nhưng đề bài gọi đây là một MÀN HÌNH chưa tồn tại. Tôi hiểu deliverable là vùng thương mại của trang đó cộng với hốc thân trang, chứ không phải toàn bộ nội dung trang. Nếu ý là dựng cả trang thì phần thân còn thiếu và theo B5 tôi không bịa nó.
