---
id: fe-blocks-proof-course-catalog-card
title: CourseCatalogCard
slug: /gates/blocks/proofs/course-catalog-card
sidebar_label: CourseCatalogCard
description: Chấm bản dựng mù của thẻ khóa học trong danh mục so với cấu trúc thật, và ghi lại những câu luật gate còn thiếu.
---

# CourseCatalogCard

> Trang: courses · Gate: blocks · Ngày: 2026-08-16

## Yêu cầu nghiệp vụ

Người học vào khu tìm khóa để chọn một khóa đáng mua trong số nhiều khóa, nên với từng khóa họ cần thấy ngay tên khóa, ảnh nhận diện, đã có bao nhiêu người tham gia, khóa hứa mang lại những điểm nổi bật nào, và quan trọng nhất là số tiền phải trả hôm nay. Giá hiển thị phải là giá đúng của chính người đang xem: người đã đăng nhập và được ưu đãi theo mức độ gắn bó thì thấy mức rẻ hơn kèm giá gốc, phần trăm giảm và số tiền tiết kiệm, còn khách chưa đăng nhập vẫn thấy giá của đợt bán đang chạy chứ không bao giờ nhìn vào một chỗ trống. Người học phải hỏi được vì sao giá lại là con số đó, và ngay tại chỗ có thể bỏ khóa vào giỏ hoặc đi tiếp vào khóa học. Một khóa đã nằm trong giỏ thì không được mời bỏ vào lần nữa.

## Cấu trúc thật

| # | Mục | Sự thật | Neo |
|---|---|---|---|
| 1 | Cặp pure/connected | Có: `component.tsx` `_CourseCatalogCard` (pure, courses) và `index.tsx` `CourseCatalogCard` (connected). Meta pure thiếu trường `shape` mà block anh em có | component.tsx:107,300 · index.tsx:114 |
| 2 | Archetype khối | Thẻ mọc/rụng slot theo dữ kiện; hai bố cục đọc trong cùng một component | component.tsx:107 |
| 3 | Tự gọi request giá | CÓ, MỘT request MỖI THẺ: `useQueryCoursePricePreviewSwr(course.id)`, key gồm viewer + courseId, null khi chưa biết viewer | index.tsx:67 |
| 4 | Tự gọi mutation giỏ | `useMutateAddToCartSwr(course.id)`, key mang courseId nên một lần bấm không đẩy thẻ khác vào trạng thái chạy | index.tsx:56 |
| 5 | Guard khi pending | Truyền `undefined` cho cả hai hook vì thẻ nghỉ mang id giả `resting-N` | index.tsx:56,67 |
| 6 | Thang state của thẻ | 3: pending \| ready \| adding. Nơi gọi chỉ truyền pending/ready; `adding` sinh từ `cart.isMutating`. KHÔNG có state lỗi | component.tsx:43 · index.tsx:90 |
| 7 | Thêm giỏ thất bại | Envelope chứ không throw; chỉ set `isInCart` khi `success === true`; nút quay lại nhãn cũ, không vẽ state lỗi nào | index.tsx:100-107 |
| 8 | Ghi nhớ đã trong giỏ | `useState(false)` trong connected; không có query giỏ để revalidate; tải lại trang là quên | index.tsx:63 |
| 9 | Đã trong giỏ thì nút thế nào | Nút VẪN CÒN, `disabled = isLoading \|\| isInCart`, chỉ đổi nhãn sang `inCart` | component.tsx:220-225 |
| 10 | Chip "đã trong giỏ" | Không có; chỉ đổi nhãn nút | component.tsx:214 |
| 11 | Hai bố cục | `layout: "grid" \| "line"` trong MỘT component: grid có `SurfaceCard`, line KHÔNG có nền riêng vì danh sách sở hữu nền/đường kẻ | component.tsx:248,280 |
| 12 | Thứ tự vùng (lưới) | cover → body{heading(title + count) → price → promises} → action | contracts/index.ts:2155,2191 |
| 13 | Số người tham gia | Text xs ở lưới, Text sm tone muted ở hàng — cùng dữ liệu, hai bậc chữ | component.tsx:144,268 |
| 14 | Mức giảm | Leaf BADGE tone success — trường DUY NHẤT ra badge, vì contract `price-discount-line` đã khoá slot discount là badge | component.tsx:133 · contracts/index.ts:1449 |
| 15 | Số tiền tiết kiệm | Text xs tone muted, ở slot `fact` của `price-note-row` | component.tsx:156 |
| 16 | "Vì sao giá này" | `TextLink` size xs. Vắng nhãn này thì CẢ dòng note biến mất, kéo theo cả savingsLabel dù có dữ liệu | component.tsx:153,163 |
| 17 | Overlay giá | Thẻ CHỈ báo cáo yêu cầu; `CoursePriceOverlay` mount ở page, `pricedCourseId` là state của page | index.tsx:25-28 · pages/CoursesCatalogPage/index.tsx:84 |
| 18 | restingCount thẻ | 3 ở cả `catalog-card-grid` lẫn `catalog-card-list`; page tự khai `RESTING_COUNT = 3`, hai con số trùng nhau bằng tay | contracts/index.ts:2119,2126 · CoursesCatalogPage/component.tsx:123 |
| 19 | restingCount lời hứa | `marked-row-list` khai 5 nhưng KHÔNG được đọc lúc chạy; số hàng là `props.promises.length` | contracts/index.ts:1169 · component.tsx:190 |
| 20 | Slot vắng dữ liệu | original / discount / note bị BỎ khỏi cây chứ không render rỗng | component.tsx:117,132,153 |
| 21 | Giá cho khách | Không bao giờ trống: giữ giá phase trong lúc preview bay | index.tsx:20-23 |
| 22 | Skeleton cho nút | `isLoading` truyền cho Text/Heading/Badge/CoverImage/SurfaceListCard nhưng KHÔNG cho hai Button và TextLink → pending vẽ nút thật, nhãn rỗng, chỉ disabled | component.tsx:214-238 |
| 23 | Bố cục danh sách | Bỏ hẳn khối promises để chiều cao hàng không bị khóa dài lời quyết định | component.tsx:241-247 |
| 24 | Dữ liệu từ nơi gọi | `CourseCatalogCardData` đã định dạng sẵn (kể cả tiền và nhãn), cộng `state`, `onView`, `onOpenPriceDetail` | component.tsx:46-80 |
| 25 | Surface owner | Lưới: thẻ tự đứng trên `SurfaceCard`. Danh sách: page bọc `CatalogLineList` trong `SurfaceListCard` rồi bên trong lại có Tree `catalog-card-list` | component.tsx:280 · CoursesCatalogPage/component.tsx:287 |
| 26 | Chủ sở hữu giỏ toàn cục | KHÔNG tồn tại. Không context, không query giỏ; chỉ `useState` trong từng thẻ | index.tsx:63 |
| 27 | Test / story | Không có cả hai; không có bản ghi trong `.artifacts/states` | — |

## Bản dựng mù

| # | Mục | Bản mù | Căn cứ bản mù nêu |
|---|---|---|---|
| 1 | Cặp pure/connected | Không nói | — |
| 2 | Archetype khối | `standing-offer` | Control mọc/rụng theo tư cách giỏ |
| 3 | Tự gọi request giá | KHÔNG: một request danh sách đã gắn phạm vi người xem, "không phải N request cho N thẻ" | Câu 4 |
| 4 | Tự gọi mutation giỏ | Mỗi thẻ một pending owner riêng cho hành động thêm giỏ | B11 |
| 5 | Guard khi pending | Không nói | — |
| 6 | Thang state của thẻ | Thẻ không có thang dữ liệu riêng; chỉ pending của hành động | Thang state chuẩn |
| 7 | Thêm giỏ thất bại | Control vẫn còn mặt để thử lại, không biến thành "đã trong giỏ" | B11 |
| 8 | Ghi nhớ đã trong giỏ | Tập id trong giỏ do một `invisible-owner` giữ, sống qua điều hướng, phát bằng Context | Câu 7 |
| 9 | Đã trong giỏ thì nút thế nào | Control bỏ-vào-giỏ VẮNG MẶT | standing-offer |
| 10 | Chip "đã trong giỏ" | Có, vì đó là state thật | B2 |
| 11 | Hai bố cục | Không nói (chỉ giả định lưới) | — |
| 12 | Thứ tự vùng | ảnh + tên → số người → lời hứa → giá → hành động | B8 |
| 13 | Số người tham gia | CHỮ, không chip không badge | B2 |
| 14 | Mức giảm | Liệt kê trong vùng giá, KHÔNG chỉ định là badge hay chữ | L8 |
| 15 | Số tiền tiết kiệm | Trong vùng giá | L8 |
| 16 | "Vì sao giá này" | Nút hỏi trong vùng giá; tiết lộ tại chỗ | B7 |
| 17 | Overlay giá | Thẻ tự giữ đóng/mở, tiết lộ inline neo vào cụm giá | B3 |
| 18 | restingCount thẻ | 6 (3 cột × 2 hàng) | Tự chọn |
| 19 | restingCount lời hứa | 3 | Tự chọn |
| 20 | Slot vắng dữ liệu | Thiếu điểm nổi bật thì cụm không vẽ, không bịa | B5 |
| 21 | Giá cho khách | Không bao giờ nhìn vào một chỗ trống; khách vẫn thấy giá đợt đang chạy | Nghiệp vụ |
| 22 | Skeleton cho nút | Không nói | — |
| 23 | Bố cục danh sách | Không nói | — |
| 24 | Dữ liệu từ nơi gọi | Vị trí + một course đóng (id, tên, ảnh, số người, khối giá, lời hứa, cờ đã-trong-giỏ, lệnh bỏ giỏ) | B3, B13 |
| 25 | Surface owner | Thẻ là surface owner; run KHÔNG được bọc card quanh danh sách | B1 |
| 26 | Chủ sở hữu giỏ toàn cục | Có, mount ở locale root | Câu 7, L1 |
| 27 | Test / story | Không nói | — |

## Chấm

| # | Mục | Thật | Mù | Kết |
|---|---|---|---|---|
| 1 | Cặp pure/connected | có | — | THIẾU |
| 2 | Archetype | thẻ mọc/rụng slot | standing-offer | TRÚNG |
| 3 | Request giá | 1 request mỗi thẻ | 1 request cho cả danh sách | LỆCH |
| 4 | Mutation giỏ khoá theo courseId | có | có | TRÚNG |
| 5 | Guard cho thẻ nghỉ | có | — | THIẾU |
| 6 | Thang state | pending/ready/adding, không failed | không thang dữ liệu, chỉ pending hành động | TRÚNG |
| 7 | Thêm giỏ thất bại | nhãn giữ nguyên, không state lỗi | control còn để thử lại | TRÚNG |
| 8 | Nhớ đã trong giỏ | useState trong thẻ, quên khi tải lại | invisible-owner sống qua điều hướng | LỆCH |
| 9 | Nút khi đã trong giỏ | disabled + đổi nhãn | vắng mặt | LỆCH (bản mù theo đúng standing-offer; mã thật vi phạm chính luật đó) |
| 10 | Chip đã trong giỏ | không | có | LỆCH |
| 11 | Hai bố cục lưới/danh sách | có trong một component | — | THIẾU |
| 12 | Thứ tự vùng | giá TRƯỚC lời hứa | lời hứa trước giá | LỆCH |
| 13 | Số người tham gia | chữ | chữ | TRÚNG |
| 14 | Mức giảm | badge success, badge duy nhất | không chỉ định | THIẾU |
| 15 | Tiết kiệm | chữ xs muted | trong vùng giá | TRÚNG |
| 16 | "Vì sao giá này" | TextLink | nút hỏi | TRÚNG |
| 17 | Overlay giá | page sở hữu | thẻ tự giữ, inline | LỆCH |
| 18 | restingCount thẻ | 3 | 6 | LỆCH |
| 19 | restingCount lời hứa | dùng độ dài thật, 5 khai mà không đọc | 3 | LỆCH |
| 20 | Slot vắng | bỏ khỏi cây | không vẽ | TRÚNG |
| 21 | Giá cho khách | không bao giờ trống | không bao giờ trống | TRÚNG |
| 22 | Nút lúc pending | không có skeleton | — | THIẾU |
| 23 | Danh sách bỏ lời hứa | có | — | THIẾU |
| 24 | Dữ liệu đóng từ nơi gọi | có | có | TRÚNG |
| 25 | Surface owner | lưới đúng; danh sách bị bọc hai lần | thẻ là surface, run không bọc | TRÚNG (lưới) |
| 26 | Chủ sở hữu giỏ toàn cục | không tồn tại | có | LỆCH |
| 27 | Test / story | không có | — | THIẾU |

Điểm: 11/27 trúng · 9 lệch · 7 thiếu.

## Gate thiếu gì

- **Một khối tự sở hữu request khi SỐ LƯỢNG request thay đổi theo dữ liệu (một request cho mỗi hàng); page owner gọi một lượt khi số request cố định.** Đây là luật phân xử duy nhất cần cho ba khối trong bộ này và nó không có trong gate: `CourseCatalogCard` tự gọi (giá riêng cho từng khóa), `DailyQuest` tự gọi (một request), `CoursePricingRail` không gọi gì. — chữa mục 3.
- **Tư cách của một khóa trong giỏ là dữ liệu máy chủ, không phải bộ nhớ của thẻ.** Không có query giỏ thì thẻ chỉ nhớ được lần bấm vừa rồi và quên ngay khi tải lại — đó là một khoảng trống backend phải nêu, không phải một lựa chọn. — chữa mục 8 và 26.
- **Nhắc lại `standing-offer` với đúng chữ "vắng mặt": control đã dùng xong thì BỎ khỏi cây, không disabled và không đổi nhãn.** Ở đây bản mù đúng và mã thật sai; gate không thiếu luật mà thiếu một GATE KIỂM để bắt vi phạm này ở tầng code. — chữa mục 9 và 10.
- **Trong một thẻ dùng để chọn mua, con số phải trả đứng TRƯỚC lời hứa: người quét lưới so tiền trước, đọc lý do sau.** B8 nói nhóm ngữ nghĩa trước gap sau nhưng không cho thứ tự giữa các nhóm. — chữa mục 12.
- **Mức giảm là BADGE; mọi con số tiền khác là chữ.** B2 nói "chip chỉ khi là state thật" nhưng không phân xử một trường vừa là con số vừa là phẩm chất, nên bản mù không dám chỉ định. — chữa mục 14.
- **Khối chỉ phát ý định mở overlay giải thích; overlay mount ở page owner và page giữ id đang mở.** Nếu thẻ tự giữ thì mỗi thẻ trong lưới là một chủ sở hữu overlay và lưới có N overlay tiềm năng. — chữa mục 17.
- **restingCount của một lưới là số hàng ĐIỂN HÌNH của một lần trả, và nó phải đọc từ contract chứ không được khai lại ở page.** Ở đây hai con số 3 trùng nhau bằng tay và có thể lệch bất cứ lúc nào. — chữa mục 18 và 19.
- **Một tập có hai cách đọc (lưới và danh sách) đi trong MỘT component qua prop `layout`; ở chế độ hàng, danh sách sở hữu nền và đường kẻ nên thẻ KHÔNG dựng surface, và những khối làm chiều cao hàng không đoán được thì bị bỏ.** Gate không có gì về hai cách đọc. — chữa mục 11, 23 và nửa sai của 25.
- **Mọi leaf trong cây nghỉ phải nhận `isLoading`, kể cả nút và liên kết; một nút thật với nhãn rỗng không phải trạng thái nghỉ.** Thang state chuẩn nói "cây ready với isLoading=true" nhưng không nói phải phủ hết leaf. — chữa mục 22.
- **Khi một slot phụ điều khiển sự tồn tại của cả một hàng (vắng `priceDetailLabel` thì mất luôn `savingsLabel`), phải khai rõ quan hệ đó.** — chữa mục 16 (chi tiết mà bản mù không thể suy ra).

## Chỗ phải đoán

Nguyên văn trường `uncertain` của bản dựng mù:

- Gate khong noi khu tim khoa co bo loc / tim kiem / sap xep / danh muc hay khong, va yeu cau nghiep vu cung khong nhac. Toi GIA DINH la khong co, va chinh gia dinh nay quyet dinh 'khong co gi dung yen => khong rail'. Neu thuc te co mot bang loc, ket luan lat nguoc sang frame-with-nav-rail (hoac frame-with-identity neu vung do con giu danh tinh nguoi xem) va cau hoi 3 se phai day trang thai loc len URL.
- Gate khong noi rail nam ben nao — o day khong co rail nen khong phai chon, nhung neu bo loc xuat hien toi se dat rail ben TRAI (thoi quen doc trai sang phai), va do se la mot lua chon khong co gate chong lung.
- restingCount khong duoc gate cho con so nao. Toi chon 6 hang the cho run va 3 dong cho diem noi bat. Ca hai deu la phong doan ve nhip thi giac, khong phai suy ra tu luat.
- Gate khong noi danh sach la LUOI hay MOT COT. Toi chon luoi vi nghiep vu la 'so sanh nhieu khoa'; so cot 3/2/1 la con so toi tu dat.
- Gate khong noi 'vi sao gia nay' la popover/overlay hay tiet lo inline. Toi chon inline neo vao cum gia vi B7 noi noi dung mo ra thang hang voi trigger, va L6 canh bao overlay tu no da la surface. Neu chon overlay thi cau tra loi van hop le, chi khac cach.
- Gate khong noi phan giai thich gia den cung payload danh sach hay phai goi rieng. Toi gia dinh den cung payload. Neu phai goi rieng, cum tiet lo moc them pending va failed cua chinh no, va theo B11 do la mot pending owner nua tren moi the.
- Gate khong noi the doc gio tu Context hay nhan co 'da trong gio' qua prop. Toi cho vung run tron tap gio vao tung muc de the giu duoc du lieu dong theo B13; nhung invisible-owner lai duoc phep 'phat qua Context', nen cach doc thang tu Context cung khong sai theo chu.
- Gate khong noi chu so huu vo hinh mount o dau. Toi chon locale root de gio song khi nguoi hoc di vao trang khoa hoc roi quay ra. L1 chi noi ve visual owner, khong noi ve data owner.
- Gate khong bat buoc phai co dau hieu nhin thay duoc cho 'da trong gio'. Nghiep vu chi cam moi bo vao lan nua. Toi them chip vi B2 cho phep chip khi la state that, nhung neu khong co chip thi the chi im lang mat nut — cung hop luat.
- Thang state chuan cua gate la thang cua KHOI CO DU LIEU, khong noi gi ve that bai cua mot HANH DONG. Trang thai 'bo vao gio that bai' la do toi dat ra tren pending owner cua hanh dong (suy tu B11), khong phai trich tu gate.
- Gate va yeu cau khong noi co phai luc nao cung co dot ban dang chay. Toi mo hinh hoa gia thanh 'luon co so tien hom nay' cong mot cum so sanh tuy chon. Neu khong co dot ban nao va khong co uu dai, con so hom nay la gia niem yet — day la suy dien cua toi tu cau 'khong bao gio nhin vao mot cho trong'.
- Khong co thong tin ve phan trang hay cuon vo han. Toi gia dinh mot run huu han mot lan. Neu co phan trang, cau hoi 3 se day so trang len URL vi trang thu N dang gui cho nguoi khac.
- Named-run doi hoi mot cai TEN cho danh sach, nhung yeu cau khong cho chu nao. Toi de tieu de la 'ten cua khu tim khoa' ma khong bia cau chu cu the.
- Gate khong noi 'di tiep vao khoa hoc' la ca the bam duoc hay mot control rieng. Toi chon: ten khoa la duong vao + mot control ro rang o cum hanh dong, vi long mot nut bo-vao-gio ben trong mot the bam-duoc-toan-bo se mo ho ve vung bam. Do la lua chon cua toi.
- Dinh dang tien te va noi tao chuoi gia (the tu format hay nhan chuoi da format) khong duoc gate noi. Toi gia dinh the nhan so + ma tien va tu dinh dang theo locale goc.
- Gate khong co luat nao ve man hinh phu thuoc dang nhap. Toi khang dinh 'khach chua dang nhap' KHONG phai trang thai cap man hinh ma chi doi hinh dang cum gia trong the — suy tu cau nghiep vu 'khong bao gio nhin vao mot cho trong', khong tu mot dieu luat.
- Ai so huu request danh sach — page owner hay chinh khoi named-run — gate khong noi. Toi cho page owner giu request va truyen du lieu dong xuong run.
- Yeu cau khong nhac hero, danh muc noi bat hay bat ky vung nao khac tren trang, nen toi de dung MOT vung. Neu trang that su co them vung, L8 (moi field thuoc dung mot vung) va L10 (chieu rong thuoc layout owner cua vung) se phai duoc chay lai.
