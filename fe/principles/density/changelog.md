---
id: fe-principles-density-changelog
title: changelog.md
slug: /fe/principles/density/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật Mật độ.
---

# changelog.md

> Phiên bản hiện tại: `2.00` · Mô-đun: `density`

## Quy tắc phiên bản

Một thay đổi luật được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc mô-đun hoặc nhóm mà nó nằm trên.

## 2.00 — 2026-08-16

Mô-đun được lập mới ở phiên bản `2.00` — không phải `1.00` — vì nó sinh ra **trực tiếp trên nhóm
`principles/`** với hình dạng năm tài liệu đã chốt, và mọi mô-đun cùng nhóm đều đang ở `2.00`. Một số
phiên bản thấp hơn sẽ nói dối rằng mô-đun này còn ở hình dạng cũ.

- **Nhận lấy một câu hỏi mà trước nay không có chủ.** Câu hỏi đó là: *thông tin được đóng gói chặt
  đến mức nào, và ai quyết định điều đó*. Trước khi có mô-đun này, câu hỏi vẫn được trả lời — nhưng
  trả lời bên trong từng thành phần, dưới dạng một thuộc tính truyền vào `size` hoặc `dense`, mọc thêm một giá trị mỗi
  lần thành phần được đặt vào một chỗ mới.
- **Chốt luật chịu lực: mật độ do NGỮ CẢNH quyết định, không do thành phần.** Cùng một hàng là thoáng
  trên một trang thuyết phục và chặt trong một bảng hai trăm dòng, mà không có gì bên trong hàng thay
  đổi. Vì câu trả lời không phải là thuộc tính của thành phần, nó không được đi vào thành phần dưới
  dạng thuộc tính truyền vào.
- **Đặt bốn mã tình huống.** `DENSITY-0` thừa hưởng ngữ cảnh, `DENSITY-1` thoáng để đọc và thuyết
  phục, `DENSITY-2` mặc định, `DENSITY-3` chặt cho danh sách dài và bảng. Mã đặt tên cho **tình
  huống**, class CSS đặt tên cho **khai báo**; hai thứ không phải một, và `DENSITY-0` không phát ra class CSS
  nào.
- **Đánh số `0`–`3` liền mạch, cố ý khác thang có lỗ của các mô-đun đo khoảng cách.** Đây không phải
  một thang đo với các bậc có thể chia đôi; đây là bốn **loại ngữ cảnh**. Giữa "thuyết phục một
  người" và "làm một việc" không có nửa bậc nào để chọn. Vì thế không cần chừa lỗ để chặn người ta
  chia đôi — không có gì để chia. Đòi `DENSITY-1.5` là đòi một loại công việc thứ năm của người đọc,
  và phải được lập luận như vậy.
- **Số `0` được giữ đúng nghĩa của nó trên nhóm này:** trạng thái **không quyết định**, không phải
  bậc thấp nhất. `DENSITY-0` là câu trả lời đúng cho gần như mọi thành phần từng được viết, và class CSS
  `[--density:0]` bị cấm vì thừa hưởng ngữ cảnh khác hẳn với việc khai báo ngữ cảnh bằng không.
- **Khai báo cố ý không vẽ ra gì.** `[--density:n]` chỉ khai báo và di truyền. Nếu nó tự vẽ, nó sẽ
  phủ quyết ba mô-đun khác từ xa. Việc khai báo được viết ra trong mã đánh dấu — thay vì nằm trong đầu
  người viết — là điều kiện để luật này kiểm tra được.
- **Cắt phạm vi bằng chữ "lặp lại".** Mật độ chỉ ấn định nhịp của những gì xuất hiện nhiều lần cùng
  hình dạng: hộp thành phần điều khiển, biểu tượng trong thành phần điều khiển, nội dung đa phương tiện biến thiết kế trong hàng, khoảng đệm bên trong của hàng và của ô bảng.
  Bảng nhịp trong `INDEX.md` là những con số duy nhất mô-đun này sở hữu.
- **Cố ý để lại cho các mô-đun láng giềng.** Khoảng cách giữa các phần tử cùng cấp thuộc về **luật quan hệ** —
  mật độ không được nhấc một khoảng cách giữa các phần tử lên hay xuống một bậc, vì quan hệ giữa hai thứ không đổi khi người
  đọc chuyển từ đọc sang quét. Khoảng đệm bên trong riêng của một ranh giới, và khoảng đệm bên trong của một plane chính, thuộc về
  **luật ranh giới**. Cỡ chữ và khoảng cách dòng của từng dòng thuộc về **luật sở hữu dòng**. Việc **bớt** hay
  **giữ** một trường thuộc về luật hé lộ: chặt hơn không bao giờ có nghĩa là ít thông tin hơn.
- **Ràng buộc cứng từ bên ngoài lập luận: sàn cảm ứng.** `DENSITY-3` không kéo một thành phần tương
  tác xuống dưới ngưỡng vùng chạm tối thiểu, vì ngón tay không nhỏ đi theo mật độ. Đây là chỗ duy
  nhất trong mô-đun mà một dữ kiện không phải công việc của người đọc được quyền cắt một mã.
- **Chốt mặc định khi phân vân là `DENSITY-2`,** không phải bậc nhỏ hơn và cũng không phải bậc chặt
  hơn. Hai ranh giới dễ phân vân đều nằm cạnh `2`, nên rơi về `2` là rơi về chỗ ít sai nhất.
- **Viết `vi.md` theo từng mã** — tình huống, dấu hiệu nhận biết, một câu tự hỏi phân định, ranh giới
  với mã kề, và danh sách tình huống nghiệp vụ hay gặp.
- **Viết `example.md` đủ trường hợp,** mỗi mã nhiều trường hợp, kèm mục ngoại lệ và mục "trông giống nhưng không
  phải mã này", cùng các ví dụ **mã lồng mã**: một bảng `DENSITY-3` bên trong một trang `DENSITY-1`,
  và một biểu mẫu `DENSITY-2` đặt lại thành lời bên trong một danh sách `DENSITY-3`.
- **Rút mọi ví dụ về `className` thuần.** Không thư viện thành phần, không hệ thống thiết kế, không kho đăng ký
  key, không tên sản phẩm. Một luật ở nhóm này phải đúng với bất kỳ giao diện nào; ví dụ cần tên
  riêng của một sản phẩm mới đọc được là ví dụ đứng sai chỗ.
- **Mô-đun gồm năm tài liệu.** Không có `prompt.md`: ánh xạ yêu cầu và bảng phân định ranh giới nằm
  cùng chỗ với những ví dụ mà chúng phân định.
