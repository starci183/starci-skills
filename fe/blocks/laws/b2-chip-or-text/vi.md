---
id: fe-blocks-laws-b2-chip-or-text-vi
title: vi.md
slug: /fe/blocks/laws/b2-chip-or-text/vi
sidebar_label: vi.md
sidebar_position: 1
description: Bảng tra chip-hay-chữ theo loại field, ba câu hỏi phân định, và bốn mâu thuẫn đang sống trong repo.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `b2-chip-or-text` · Luật: [`INDEX.md`](./INDEX.md)

# Chip hay chữ

Câu hỏi này được hỏi lại ở mọi hàng, mọi thẻ, mọi lần. Nên tài liệu này là một **bảng tra**, không
phải một bài luận: mang một field tới, đọc một dòng, nhận một cách vẽ.

## Bảng tra

| Mã | Loại field | Vẽ bằng | Ví dụ trong sản phẩm |
|---|---|---|---|
| `B2-1` | Số đếm, số lượng | **chữ** ở cuối hàng | số kết quả theo phạm vi tìm kiếm |
| `B2-2` | Nhãn phân loại, tên loại | **chữ** | `kind`, tag bài toán, tên giai đoạn giá, hình thức làm việc, nơi ở, chức danh |
| `B2-3` | Trạng thái vòng đời do máy chủ đổi, có hệ quả | **chip** (`Badge`), tone mang nghĩa | đã nhận thưởng, đang giảm giá, sắp hết chỗ, học thử, testcase đúng/sai |
| `B2-4` | Cái đang được chọn | **không chip, không tick** — dùng sơn của chính hàng | phạm vi tìm kiếm đang chọn |
| `B2-5` | Trạng thái nhiều kết cục mà người đọc đang ngồi chờ | **`StatusDot` + `Text`** | mười một tình huống của máy chấm |
| `B2-6` | Glyph nhắc lại đúng cái chữ đã nói | **không vẽ** | icon tím `review` sau từng bài xem trước |
| `B2-7` | Con số backend không phục vụ | **không vẽ**, kể cả số `1` | số tin chưa đọc |

Field không có trong bảng thì là `B2-2`. Mặc định là chữ; chip phải chứng minh được mình.

## Ba câu hỏi

Một field chỉ lên `B2-3` khi cả ba câu đều "có". Một câu "không" là xuống `B2-2`.

1. **Nó có tự đổi mà người đọc không đụng vào hàng này không?** Không → nó là tên gọi, không phải
   trạng thái.
2. **Cái đổi đó có hệ quả gì không?** Không → nó là trang trí.
3. **Tone có mang nghĩa không — đổi `success` thành `danger` có sai không?** Không → tone chỉ là
   màu, và chip chỉ là chrome.

Câu ba bắt được nhiều thứ nhất. Một tag đeo chip `neutral` trượt ngay: không có tone nào sai được,
vì không có nghĩa nào cho tone mang.

## Vì sao mặc định là chữ

Ba lần thầy bác đều nói cùng một ý bằng ba cách khác nhau. Với số đếm: đó là **rule của hàng** rồi,
hàng đã có chỗ cho một dữ kiện cuối, không cần bọc tròn. Với tên giai đoạn giá: so sánh các giai
đoạn cần **typography đồng cấp**, chip làm một giai đoạn nhìn khác hạng với các giai đoạn kia trong
khi chúng vốn ngang nhau. Với icon tím sau mỗi bài: nó không thêm gì vào cái tên bài đã nằm ngay
cạnh.

Cộng lại: chip là một tuyên bố *cái này khác loại với phần còn lại của hàng*. Khi nó không khác
loại, tuyên bố ấy sai.

## Bốn mâu thuẫn đang sống

Repo sống có mười một chỗ dựng `Badge`. Bốn trong số đó đang đeo chip lên một nhãn phân loại:

| Chỗ | Field | Đúng ra là |
|---|---|---|
| `ProfileHero` | nơi ở, hình thức làm việc | `B2-2` — và chính khối này đã vẽ số người theo dõi và chức danh bằng chữ |
| `CoursePricingRail` | tên giai đoạn giá | `B2-2` — đã có một dòng từ chối đúng cho field này |
| `ProblemReadingColumn` | tag bài toán | `B2-2` — tone `neutral`, tức không có nghĩa nào để mang |
| `SolutionEditor` | nhãn testcase khi chưa chạy | `B2-4` — nó đang làm tab chọn testcase |

Mâu thuẫn nặng nhất nằm trong cùng một khối: `ProfileHero` vẽ nơi ở và hình thức làm việc bằng
chip, còn số người theo dõi, số người đang theo và chức danh bằng chữ. Cả năm đều là field phụ, và
không cái nào là trạng thái.

Chỗ thứ năm nằm ở tầng dưới nhưng do khối nạp: hàng kết quả của Global Search vẫn giữ nguyên chuỗi
class `rounded-full bg-default px-2 py-1` mà thầy đã bác ở nhánh phạm vi, và khối
`GlobalSearchResults` nạp vào đó `statusLabel ?? kindLabel` — trong đó `kindLabel` là phân loại.
Cách đối xử bị bác sống sót bằng cách đổi nhánh.

## Chỗ chip là đúng

Để bảng tra không bị đọc thành "cấm chip", ghi rõ những chỗ chip đang đúng:

- **Đã nhận thưởng** — máy chủ đổi, người đọc không đổi được, và nó chặn quyền nhận lần nữa.
- **Đang giảm giá** và **sắp hết chỗ** — hai trạng thái của phép tính giá, tone `success` và
  `warning` không hoán đổi được.
- **Testcase đúng/sai sau khi chạy** — tone `success`/`danger` mang đúng kết quả.
- **Cấp độ khoá học** — thầy đã xem và chỉ yêu cầu ba cấp ba màu, không yêu cầu bỏ chip. Một thang
  có thứ tự mà tone mang thứ tự thì qua được câu hỏi ba.
