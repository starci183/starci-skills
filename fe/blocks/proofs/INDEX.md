---
id: fe-blocks-proofs-index
title: Proofs — blocks
slug: /fe/blocks/proofs
sidebar_label: Proofs
description: Bảng điểm phép thử giữ kín đáp án cho ba khối thuộc ba trang founder tự tin, và danh sách luật gate còn thiếu ở tầng block.
---

# Proofs — blocks

> Gate: blocks · Ngày: 2026-08-16 · Phép thử: một agent đọc code ghi cấu trúc thật, một agent khác chỉ nhận yêu cầu nghiệp vụ cộng gate và dựng lại từ đầu.

## Bảng điểm

| Khối | Trang | Mục chấm | TRÚNG | KHÁC MÀ ĐƯỢC | LỆCH | THIẾU | Tỉ lệ trúng |
|---|---|---|---|---|---|---|---|
| [DailyQuest](./daily-quest) | dashboard | 26 | 16 | 1 | 3 | 6 | 62% |
| [CourseCatalogCard](./course-catalog-card) | courses | 27 | 11 | 0 | 9 | 7 | 41% |
| [CoursePricingRail](./course-pricing-rail) | course-details | 30 | 17 | 0 | 9 | 4 | 57% |
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
