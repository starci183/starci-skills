---
id: fe-blocks-proofs-index
title: Proofs — blocks
slug: /gates/blocks/proofs
sidebar_label: Proofs
description: Bảng điểm phép thử giữ kín đáp án cho ba khối thuộc ba trang founder tự tin, và danh sách luật gate còn thiếu ở tầng block.
---

# Proofs — blocks

> Gate: blocks · Ngày: 2026-08-16 · Phép thử: một agent đọc code ghi cấu trúc thật, một agent khác chỉ nhận yêu cầu nghiệp vụ cộng gate và dựng lại từ đầu.

Trang này giữ hai lần chấm:

- **Lần 1 — phép thử một-gate** (bên dưới): ba KHỐI được dựng lại độc lập.
- **Lần 2 — [phép thử chuỗi đầy đủ](#lần-2--phép-thử-chuỗi-đầy-đủ)**: năm gate chạy nối tiếp trên ba TRANG, mỗi gate chỉ nhận đầu ra gate trước.

## Bảng điểm

| Khối | Trang | Mục chấm | TRÚNG | KHÁC MÀ ĐƯỢC | LỆCH | THIẾU | Tỉ lệ trúng |
|---|---|---|---|---|---|---|---|
| [DailyQuest](./DailyQuest.md) | dashboard | 26 | 16 | 1 | 3 | 6 | 62% |
| [CourseCatalogCard](./CourseCatalogCard.md) | courses | 27 | 11 | 0 | 9 | 7 | 41% |
| [CoursePricingRail](./CoursePricingRail.md) | course-details | 30 | 17 | 0 | 9 | 4 | 57% |
| **Cộng** | | **83** | **44** | **1** | **21** | **17** | **53%** |

`DailyQuest` cao nhất vì nó là khối đơn giản nhất và vì `standing-offer` mô tả nó gần như từng chữ. `CourseCatalogCard` thấp nhất vì gate không có gì để nói về một khối vừa tự fetch, vừa mang hai bố cục đọc, vừa chỉ báo cáo ý định mở overlay.

## Gate còn thiếu

Xếp theo số khối chứng minh nó cần.

### 3 khối

1. **Mỗi khối có dữ liệu là một CẶP: `component.tsx` thuần nhận một union đã chốt và không import i18n hay hook nào; `index.tsx` connected sở hữu request, dịch chuỗi, định dạng tiền và chọn state. Nửa connected được gọi KHÔNG PROP.** Gate không có một chữ nào về cặp này. Hệ quả: bản mù mô tả một khối duy nhất vừa fetch vừa vẽ, nên trả lời sai câu "nhận gì từ nơi gọi" ở cả ba khối. `CoursePricingRail` còn là ca ngược lại — nó KHÔNG có twin (chỉ pure + projection) và đó chính là lý do pending của trang không đổ xuống được.
2. **Một khối tự sở hữu request khi SỐ LƯỢNG request thay đổi theo dữ liệu (một request cho mỗi hàng); ngược lại page owner gọi một lượt và truyền dữ liệu đã chốt xuống.** Đây là luật phân xử duy nhất cần cho cả ba: `DailyQuest` tự gọi một request, `CourseCatalogCard` tự gọi một request MỖI THẺ, `CoursePricingRail` không gọi gì. Bản mù đoán trúng hai, trượt một, và trượt đúng cái tốn kém nhất.
3. **restingCount khai ở contract; khối đọc ngược từ contract, không viết con số trong mã; con số là số hàng ĐIỂN HÌNH của một lần trả.** Ba khối, ba lần đoán, ba lần trượt (3 vs 5, 6 vs 3, và một restingCount bịa ra cho một slot không hề lặp).
4. **Khoá cache của khối đọc dữ liệu riêng người xem phải nối danh tính người xem, và bằng `null` khi danh tính chưa giải.** Gate im lặng hoàn toàn về cache; không có khoá thì khối bắn request nặc danh rồi vẽ dữ liệu của người khác.

### 2 khối

5. **Chỉ cụm nào TỰ ĐỌC dữ liệu mới có thang state. Cụm chỉ nhận chuỗi đã chốt thì hình dạng của nó là SLOT CÓ hay SLOT VẮNG, không phải pending/empty/failed.** Câu luật đắt nhất trong cả bộ chấm: một mình nó gây năm dòng LỆCH ở `CoursePricingRail` (bảng đợt giá, suất còn lại, số người ghi danh, nhóm tiền, thang state tổng).
6. **Một danh sách ngắn, cố định, không có state riêng là MỘT leaf nhận mảng, không phải một `named-run`.** `named-run` dành cho danh sách tự đọc dữ liệu. Không có slot lặp thì không có restingCount.
7. **Khối chỉ phát ý định mở overlay giải thích; overlay mount ở page owner và page giữ id đang mở.** Nếu thẻ tự giữ thì một lưới N thẻ là N chủ sở hữu overlay.
8. **Một trường vừa là con số vừa là phẩm chất (mức giảm) là BADGE; mọi con số tiền khác là chữ.** B2 nói "chip chỉ khi là state thật" nhưng không phân xử ca này, nên một bản mù không dám chỉ định và một bản phải tự chọn thay gate.

### 1 khối

9. **Trạng thái pending của trang phải ánh xạ xuống trạng thái nghỉ của khối; truyền chuỗi rỗng với state `ready` là vẽ một khối ready rỗng ruột.** (CoursePricingRail — khoảng trống có thật trong mã)
10. **Mọi leaf trong cây nghỉ phải nhận `isLoading`, kể cả nút và liên kết.** Một nút thật với nhãn rỗng không phải trạng thái nghỉ. (CourseCatalogCard)
11. **Một tập có hai cách đọc (lưới và hàng) đi trong MỘT component qua prop `layout`; ở chế độ hàng, danh sách sở hữu nền nên thẻ không dựng surface, và khối làm chiều cao hàng không đoán được thì bị bỏ.** (CourseCatalogCard)
12. **Khối tự vẽ surface thì phải khai luôn giới hạn chiều cao và vùng cuộn của nó khi nó dính.** (CoursePricingRail)
13. **Nhãn của một section do BRANCH phát, không do contract cha; contract cha chỉ khai hình dạng.** Hai nơi cùng tuyên bố sở hữu một nhãn và không luật nào phân xử. (DailyQuest)
14. **Trước khi vẽ một control hành động, xác nhận mutation tương ứng có tồn tại.** `claimable` của `DailyQuest` không đạt tới được từ đường sống và toàn repo không có mutation claim nào. B11 nói mỗi action một pending owner nhưng không bắt kiểm action có thật.
15. **Phân biệt `undefined` (chưa về) với `null` (máy chủ trả lời là không có gì): `null` rơi vào empty, `undefined` rơi vào pending.** (DailyQuest)
16. **Một trường lấy về mà không hiển thị là trường THỪA trong query, không phải một trục để dựng thêm state.** Bản mù biến `date` thành chủ sở hữu vô hình và một state ngày-đã-lật mà mã thật không có. (DailyQuest)
17. **Tư cách của một khóa trong giỏ là dữ liệu máy chủ, không phải bộ nhớ của thẻ.** Không có query giỏ thì thẻ quên ngay khi tải lại — một khoảng trống backend, không phải một lựa chọn. (CourseCatalogCard)
18. **Trong thẻ dùng để chọn mua, con số phải trả đứng TRƯỚC lời hứa.** B8 nói nhóm ngữ nghĩa trước gap sau nhưng không cho thứ tự giữa các nhóm. (CourseCatalogCard)

### Không thiếu luật — thiếu gate KIỂM

19. `standing-offer` đã nói đúng chữ "control VẮNG MẶT chứ không disabled", và bản mù theo đúng. Mã thật của `CourseCatalogCard` thì `disabled = isLoading || isInCart` rồi đổi nhãn. Đây là chỗ duy nhất trong cả sáu màn mà **bản mù đúng và mã thật sai**; thứ cần thêm là một lint hoặc một mục audit, không phải một câu luật mới.

## Chỗ gate im lặng nhất

Gom từ trường `uncertain` của cả ba bản dựng mù, xếp theo số bản cùng phải đoán.

| Chỗ im lặng | Số bản mù phải đoán |
|---|---|
| restingCount: gate bắt có, không cho quy tắc suy ra con số | 3/3 |
| Ai gọi dữ liệu — page owner hay chính khối | 3/3 |
| Tiết lộ tại chỗ hay overlay, và ai giữ trạng thái mở | 3/3 |
| Thất bại của một HÀNH ĐỘNG nằm ở đâu (thang state chuẩn chỉ nói về khối có dữ liệu; B11 chỉ nói pending) | 3/3 |
| Chip/badge hay chữ cho một trường suy ra được (mức giảm, "đã trong giỏ") | 3/3 |
| `standing-figure` "không có failed riêng" mâu thuẫn thang state chuẩn | 2/3, một bản gọi thẳng đây là mâu thuẫn của gate |
| `standing-offer` "vắng mặt chứ không disabled" đụng thang state "pending là cây ready" — control nên vắng hay tồn tại ở dạng đang tải | 1/3 nêu thẳng, 2/3 chạm phải |
| Khoá cache có mang danh tính người xem không | 2/3 |
| Định dạng tiền và locale do khối hay do nơi gọi | 2/3 |
| Cuộn trong khối: B3 nói khối sở hữu scroll nhưng không cho ngưỡng chiều cao | 2/3 |
| Trạng thái chưa đăng nhập / hết phiên ở tầng khối | 2/3 |
| Nút thử lại ở `failed` có hợp lệ không, khi `standing-offer` chỉ nói về control nghiệp vụ | 2/3 |
| Ảnh/media không khớp archetype khối nào trong năm cái | 1/3 nêu thẳng |
| Mode BÊN TRONG một khối (mua ↔ học thử) — gate chỉ định nghĩa tab ở tầng navbar | 1/3 nêu thẳng |

---

## Lần 2 — phép thử chuỗi đầy đủ

> Ngày: 2026-08-16 · Chuỗi: layouts → blocks → principles → patterns → lints · Chấm cả TẬP khối của mỗi trang, không chỉ một khối.

### Bảng điểm

| Trang | best-of-set | recommended | TRÚNG | KHÁC MÀ ĐƯỢC | LỆCH | THIẾU | Không đo được |
|---|---|---|---|---|---|---|---|
| [dashboard](./dashboard.md) | không đo được | **12/21 · 57%** | 12 | 0 | 7 | 3 | 1 |
| [courses](./courses.md) | không đo được | **4/12 · 33%** | 4 | 0 | 4 | 4 | 3 |
| [course-details](./course-details.md) | không đo được | **12/17 · 71%** | 11 | 1 | 0 | 4 | 4 |
| **Trung bình** | — | **54%** | | | | | |

**best-of-set không đo được** vì chuỗi chỉ mang một phương án qua ranh giới. Cận dưới bằng điểm recommended.

**Một quan sát quyết định về hình dạng điểm.** Ba trang trải từ 33% tới 71%, và biến số phân biệt chúng không phải độ khó của trang mà là **cách câu nghiệp vụ gọi tên thứ nó muốn**:

- `course-details` (71%) — nghiệp vụ nói bằng DANH TỪ: "điều kiện nên có trước khi bắt đầu (theo thứ tự)", "toàn bộ chương trình học", "các câu hỏi thường gặp". Gate đoán trúng tên khối mà không cần đọc repo. Không có LỆCH nào.
- `courses` (33%) — nghiệp vụ nói bằng QUAN HỆ: "khóa nào đã sở hữu thì tuyệt đối không được chào bán lại lần nữa". Quan hệ giữa hai nhóm không có danh từ nào để bám, nên nó không sinh ra khối nào.
- Mọi mệnh đề ĐIỀU KIỆN đều rơi ở cả ba trang: "khóa miễn phí hay đã sở hữu thì không còn chuyện thêm vào giỏ", "chưa đăng nhập thì phải đăng nhập trước", "không mảng chậm nào được giữ cả màn hình lại chờ".

Gate blocks hiện **đọc danh từ tốt, đọc quan hệ kém, và gần như không đọc điều kiện.**

### Gate còn thiếu luật gì (lần 2)

| # | Câu luật lẽ ra đã ngăn được | Trang |
|---|---|---|
| 1 | **Mọi mệnh đề điều kiện trong câu nghiệp vụ phải trở thành một dòng "trường này ẩn khi …" gắn vào đúng khối.** | 3/3 |
| 2 | **Trước khi đặt tên một hook mới, gate phải liệt kê hook đã có trả lời cùng câu hỏi. Không có bảng hook làm đầu vào thì gate DỪNG và hỏi.** | 3/3 |
| 3 | **Mọi nguồn dữ liệu của mọi khối phải trỏ về một file trong danh sách.** | 2/3 |
| 4 | **Một điều khiển đã có leaf trong từ vựng thì không được dựng lại thành khối hay leaf mới.** | 2/3 |
| 5 | **Một danh sách hành động do nghiệp vụ liệt kê phải được ĐẾM lại.** | 2/3 |
| 6 | **Một khối chỉ ghép các khối đã tự fetch thì không có twin và không giữ request.** | 1/3 |
| 7 | **Mỗi danh từ trong câu nghiệp vụ phải đối chiếu ngược ra một khối; danh từ không có khối phải thành một dòng nợ.** | 1/3 |
| 8 | **Tham số truy vấn của một trang phải có đúng một chủ.** | 1/3 |
| 9 | **`restingCount` phải khớp cardinality thật khi cardinality đó do nghiệp vụ cố định.** | 1/3 |

Câu 2, 4 và 9 là bản lặp lại của câu 3, 4 và 6 ở lần 1 — cùng một chỗ thiếu, bắt lại bằng một phép thử khác.

### Chỗ gate im lặng nhất (lần 2)

`uncertain` của gate blocks **không tồn tại trong chuỗi mù**. Dấu vết duy nhất là hai dòng nợ do các gate sau chép lại:

> "Ba lược đồ meta cùng tồn tại trong repo sống và không gate nào đọc meta, nên nhãn meta trong kế hoạch này là lời khai chứ không phải bằng chứng."

> "Gate không nói khối được nhận làn hành động bằng cách nào: `BlockProps` chỉ có state và props, mà chín khối vẫn cần handler… đó là một chỗ luật im, không phải một chỗ luật cho phép."

Câu thứ hai là chỗ im lặng đắt nhất của cả ba trang: nó không sai ở đâu cả nên không cổng nào chặn, và hệ quả là hàng rào hai-slot của `BlockProps` mất hiệu lực trên mọi khối của mọi trang.

## Lượt 2 — 2026-08-17

### Bảng điểm

| Trang | Lượt 1 (recommended) | Lượt 2 (recommended) | Delta | best-of-set |
|---|---|---|---|---|
| [dashboard](./dashboard.md) | 12/21 · **57%** | 2.5/16 · **16%** | **−41** | không đo được |
| [courses](./courses.md) | 4/12 · **33%** | 8/16 · **50%** | **+17** | không đo được |
| [course-details](./course-details.md) | 12/17 · **71%** | `null` · **0%** | **−71** | không đo được |
| **Trung bình hai trang chạy được** | **45%** | **33%** | **−12** | |
| **Trung bình ba trang** | **53.7%** | **22%** | **−31.7** | |

**Gate blocks là cổ chai của lượt hai.** Đây là ô duy nhất mà một trang tụt bốn mươi mốt điểm trong
khi gate ngay trên nó tăng mười chín. Trên trang dashboard, chuỗi đi 78% (layouts) rồi rơi thẳng
xuống 16% ở bước kế tiếp — **vách rơi 62 điểm giữa hai ranh giới liền nhau, và đó là điểm gãy sớm
nhất của cả chuỗi lượt hai.**

### Vì sao tụt: đúng-hẹp thay cho sai-rộng

Bốn khối trang dashboard viết ra ở lượt hai **tốt hơn** lượt một: `DailyQuest` đọc `restingCount` từ
`CONTRACTS` thay vì hằng số tay, `pending-gate.test.tsx` xuất hiện đúng như fixture mô tả và không có
ở lượt một, mọi JSDoc nêu vì-sao chứ không nêu chữ-ký. Cái sụp là **độ phủ**: 4 trên 13 khối, 2 trên
4 mặt. Năm mục lượt một đo được thì lượt hai không còn gì để đo.

Với một cổng có nhiệm vụ **liệt kê thành viên**, đúng-hẹp là thất bại nặng hơn sai-rộng: sai-rộng để
lại thứ cho gate sau sửa; đúng-hẹp để lại một khoảng trắng mà mọi gate sau đều chấm là xanh.

Trang courses đi ngược lại và đi đúng hướng: **ba thứ nghiệp vụ nói ra bằng chữ mà lượt một đánh rơi**
— giá theo từng người, lối xem cách tính giá, hai cách đọc cho hai kiểu người — lượt hai nhặt lại cả
ba, và nhặt đúng chỗ (giá riêng chỉ ĐÈ chứ không nháy skeleton; overlay thuộc page chứ không thuộc thẻ).

### Gate còn thiếu luật gì

| # | Câu luật lẽ ra đã ngăn được | Trang | Trạng thái |
|---|---|---|---|
| 1 | **Gate blocks phải trả đủ thành viên cho MỌI vùng gate layouts đã mở; một vùng không có thành viên nào là lỗi chặn, không phải dòng nợ.** | 2/3 | **mới ở lượt 2** — hai mặt tab có route, có tên page, không có khối nào |
| 2 | **Số thành viên của một vùng phải khớp `restingCount` của slot mở vùng đó.** | 2/3 | chưa vá — rail khai 2, giao 1 |
| 3 | **Câu nghiệp vụ "mảng nào có kết quả trước thì hiện trước" là một luật về SỐ REQUEST, không phải một sở thích kiến trúc.** | 1/3 | chưa vá — hai lượt liên tiếp gộp bốn giá trị vào một request, hai lượt liên tiếp viết một lý do nghe rất chỉnh |
| 4 | **Câu nghiệp vụ dạng "tuyệt đối không được X" phải sinh ra một VÙNG hoặc một PHÉP LỌC có tên.** | 1/3 | chưa vá — dedupe khoá đã sở hữu mất hai lượt |
| 5 | **Một khối pure không được NHẬN cờ chờ; nó VIẾT cờ chờ.** | 1/3 | chưa vá — `CatalogToolbar` và `CourseCatalogCard` đều nhận `isLoading` |
| 6 | **Một điều khiển có leaf sẵn thì phải dùng leaf; nếu phải bọc thì phải kê tên leaf bị bọc.** | 2/3 | nửa vá |
| 7 | **Một khối bị nêu tên nhưng không có thân phải được đánh dấu, và các gate sau phải từ chối chấm nó là đạt.** | 1/3 | **mới ở lượt 2** — năm khối như vậy đi qua gate cuối với kết quả `pass` |
| 8 | **Một bước gãy phải trả về đối tượng, không phải `null`.** | 1/3 | mới ở lượt 2 |

### Gate im lặng ở đâu

Câu im lặng đắt nhất của gate blocks qua hai lượt:

> "`BlockProps` là `{ state, props }` và không gì khác, và `ComponentData` cấm hàm, nên nửa vẽ của một
> block theo canon KHÔNG có làn nào cho handler. Mọi block trong kế hoạch này đều mang `on`, và tôi
> không báo đó là vi phạm: hoặc `on` là một thiếu sót có chủ ý của tài liệu, hoặc một block thật sự
> không được nhận handler, và cách đọc thứ hai làm phần lớn màn hình này không viết được."

Hai lượt, cùng một câu, không ai trả lời. Đây là hình dạng props của mọi khối trong nhà.

Và một quan sát về chính bảng điểm này: **ô cao nhất của gate blocks ở lượt một (course-details, 71%,
0 LỆCH) là ô mất trắng ở lượt hai.** Điểm cao không được bảo vệ bởi bất cứ thứ gì ngoài việc chuỗi
chạy trọn.
