---
id: fe-patterns-cache-key-audit
title: audit.md
slug: /fe/patterns/cache-key/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định, khả năng neo và tầng giữ của luật cache key.
---

# audit.md

> Version: `2.00` · Module: `cache-key`

Audit này kiểm xem luật có chọn được một quyết định key từ **dữ kiện nghiệp vụ đã nêu**, và chỉ từ
đó — rồi kiểm xem có gì thật sự giữ được quyết định ấy sau khi người review đi khỏi.

## Verdict

Chấp nhận, kèm một điểm yếu đã biết và không giấu: **không mã nào trong module này được giữ bằng
máy**. Luật đúng, phân định được, neo được vào code thật, nhưng tầng giữ của cả năm mã đều là
`documented`.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `CACHE-1` vs `CACHE-2` | Loại trừ được khi đã nêu: hai người **cùng đăng nhập** có nhận hai kết quả khác nhau không |
| `CACHE-1` vs `CACHE-3` | Loại trừ được khi đã nêu thứ bị dùng chung sai là dữ liệu hay `isMutating` |
| `CACHE-1` vs `CACHE-4` | Loại trừ được khi đã nêu mảnh đó **thiếu** hay **chưa tới** |
| `CACHE-3` vs ngoại lệ bulk | Loại trừ được khi đã nêu số nút cùng tồn tại trên màn hình |
| `CACHE-4` vs `CACHE-5` | Loại trừ được khi đã nêu chữ `null` nằm ở vị trí key hay vị trí kết quả |
| `CACHE-5` vs ngoại lệ hợp đồng | Loại trừ được khi đã nêu server có phân biệt "hỏng" với "không có" hay không |
| Thiếu dữ kiện | Hỏi đúng một câu trong bảng phân định của `example.md` rồi dừng |

## Findings

- Năm mã không phải năm lát cắt của một trục. `CACHE-1` là mã tổng quát; `CACHE-2` và `CACHE-3` là
  hai mảnh bị bỏ sót nhiều nhất và hỏng theo hai kiểu mà `CACHE-1` không mô tả được (hỏng khi đăng
  xuất, hỏng ở trạng thái chạy của một danh sách); `CACHE-4` và `CACHE-5` giữ hai đầu mà key không
  với tới. Gộp lại thì đúng nhưng vô dụng.
- Chữ `null` mang **hai** nghĩa trong cùng một module — `null` ở vị trí key (`CACHE-4`) và `null` ở
  vị trí kết quả (`CACHE-5`). Đây là chỗ dễ đọc nhầm nhất của phiên bản này và đã được nói rõ ở cả
  ba record.
- Cả năm mã đều **neo được** vào code thật. Không mã nào phải ghi `chưa neo được`.
- Bốn trong năm mã neo vào **cùng một file**. Đó là một dấu hiệu tốt (một hook đúng thì đúng nhiều
  luật cùng lúc) và cũng là một rủi ro (file ấy bị sửa thì bốn neo hỏng cùng lúc).
- Luật gốc dạng phẳng có một câu về `sources/fe/the-split.mjs` dễ bị đọc thành "đã có lint giữ". Bảng
  `Tầng giữ` đã tách bạch: rule đó giữ **chỗ** key được dựng, không giữ **thứ** nằm trong key.

## Decisions

- Giữ đúng năm mã, đúng số và đúng nghĩa: `CACHE-1`, `CACHE-2`, `CACHE-3`, `CACHE-4`, `CACHE-5`.
- Giữ nguyên mọi quyết định của bản phẳng: fetcher đọc tham số ra từ key; fingerprint chứ không phải
  credential; một hook một dòng; `null` thay cho placeholder; lỗi ở `error` chứ không ở dữ liệu;
  nghĩa của `null` viết tại chỗ bóc.
- Ghi `documented` cho cả năm thay vì để trống hoặc suy diễn ra `enforced` từ một rule của luật khác.
- Giữ mọi ví dụ ở dạng hook và TSX thường, không tên sản phẩm — trừ bảng `Anchor`, là chỗ duy nhất
  trỏ ra ngoài, và trỏ bằng đường dẫn tương đối tới gốc repo.
- Nâng luật thành **bắt buộc**: mọi hook đặt tên cho một câu trả lời được cache đều rơi vào ít nhất
  một mã.

## Rủi ro còn mở

Cả năm mã đều chỉ ở tầng `documented`. Dưới đây là điều một lint rule **sẽ phải nhìn thấy** để giữ
được từng mã — hoặc lý do không rule nào giữ nổi.

- **`CACHE-1` — không rule nào giữ được, về nguyên tắc.** Để biết một mảnh còn thiếu, rule phải biết
  câu trả lời của server đổi theo những gì. Đó là dữ kiện nằm ở backend, không nằm trong cú pháp.
  Rule nhìn thấy key là một mảng ba định danh; nó không thể thấy rằng lẽ ra phải có định danh thứ tư.
  **Phần giữ được:** một rule cú pháp có thể bắt nửa sau của mã này — fetcher không nhận tham số nào
  từ key mà thân hàm lại tham chiếu một biến ngoài trùng tên với một mảnh của key. Đó là một mẫu
  AST đóng và đáng viết.
- **`CACHE-2` — không rule nào biết câu trả lời nào là riêng tư.** Không có gì trong cú pháp phân
  biệt "danh sách của tôi" với "danh sách công khai". **Phần giữ được:** hai mẫu hẹp mà rule bắt được
  chắc chắn — một biến tên `token` (hoặc kết quả trực tiếp của một hook phiên) xuất hiện trong biểu
  thức key, và một key hằng trên một hook mà tên của nó khớp một danh sách tiền tố riêng tư đã quy
  ước. Mẫu thứ hai đổi luật thành luật đặt tên, nên nó là một đề xuất rule change chứ không phải một
  cách đọc khác của luật hiện tại.
- **`CACHE-3` — rule không đếm được số nút trên màn hình.** Việc một hook được gọi bên trong một
  component render lặp theo `map` là dữ kiện nằm ở **call site**, thường ở file khác. **Phần giữ
  được:** một mẫu cục bộ đáng ngờ — `useSWRMutation` với key là một chuỗi hằng, nằm trong một file
  cũng nhận một prop kiểu mảng. Tín hiệu yếu, dễ báo nhầm, chưa đủ để đặt ở mức `error`.
- **`CACHE-4` — đây là mã gần với `enforced` nhất.** Một rule có thể bắt được, thuần cú pháp và gần
  như không báo nhầm: **`??`, `||` hoặc một literal (`""`, `0`, `"guest"`, `"anonymous"`) xuất hiện
  bên trong biểu thức key của `useSWR`/`useSWRMutation`**. Nó không chứng minh được key đầy đủ, nhưng
  nó giết đúng cái ngoại lệ nguy hiểm nhất — placeholder khoác lên mình một key hợp lệ. Nếu module
  này bao giờ có `sources/fe/cache-key.mjs`, đây là rule đầu tiên nên viết.
- **`CACHE-5` — nửa đầu giữ được, nửa sau thì không.** Rule bắt được `try`/`catch` mà nhánh `catch`
  trả về `null`, `[]` hoặc `undefined` **bên trong một fetcher** — nhận diện fetcher bằng vị trí đối
  số của `useSWR`. Nửa sau, tức là "nghĩa của `null` phải được viết xuống", thì không: rule không đọc
  được doc comment để biết nó có nói đúng thứ cần nói hay không.
- **Bảng `Anchor` căng với `Scope`.** Shelf này cấm nêu tên repository, còn `Anchor` bắt buộc phải
  trỏ vào code thật. Cách hoà giải hiện tại là dùng đường dẫn tương đối tới gốc repo và không gọi tên
  repo. Nó giữ được cả hai yêu cầu, nhưng chỉ đúng chừng nào còn đúng **một** ứng dụng front end
  tiêu thụ luật này. Có ứng dụng thứ hai thì bảng này phải đổi hình.
- **Bốn neo nằm trên một file.** Sửa `useQueryCoursePricePreviewSwr.ts` là làm hỏng neo của `CACHE-1`,
  `CACHE-4` và `CACHE-5` cùng lúc mà không có gì báo. Không có cơ chế nào hiện kiểm được rằng một
  đường dẫn trong bảng `Anchor` vẫn còn tồn tại.

## Re-audit Triggers

- Có ai đề xuất thêm một mã `CACHE-<n>` mới, hoặc đánh số lại một mã đã có.
- `sources/fe/cache-key.mjs` được tạo ra — khi đó bảng `Tầng giữ` phải đổi và đây là lần đầu module
  có dòng `enforced`.
- Một file trong bảng `Anchor` bị đổi tên, di chuyển, hoặc mất đi đoạn code mà cột "what to look for"
  đang trỏ vào.
- Xuất hiện ứng dụng front end thứ hai tiêu thụ luật này, làm đường dẫn tương đối trong `Anchor` hết
  đơn nghĩa.
- Có một lần rò rỉ dữ liệu giữa hai người đọc trên cùng một tab — đó là `CACHE-2` thất bại, và tầng
  `documented` là thứ đã để nó lọt.
- Một ví dụ trong `example.md` cần tên riêng của một sản phẩm mới đọc được.
