---
id: fe-principles-elevation-changelog
title: changelog.md
slug: /fe/principles/elevation/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật Độ nổi.
---

# changelog.md

> Phiên bản hiện tại: `2.00` · Mô-đun: `elevation`

## Quy tắc phiên bản

Một thay đổi luật được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc mô-đun hoặc nhóm mà nó nằm trên.

## 2.00 — 2026-08-16

Mô-đun được lập mới ở số chính `2.00` để đứng cùng hàng với các mô-đun khác trên cùng nhóm. Nó không
kế thừa một bộ quy tắc `1.x` nào; số này nói về **hình dạng mô-đun**, không nói về tuổi của luật.

- **Nhận lấy một câu hỏi trước nay không có chủ.** Câu hỏi là: *cái gì nằm trên cái gì, và bằng phương
  tiện nào*. Trước mô-đun này, câu hỏi đó được trả lời rải rác — một cái bóng chọn theo mắt ở chỗ này,
  một con số `z` chọn theo tranh chấp ở chỗ kia — nên không ai sai được, và vì thế không ai đúng được.
- **Đứng trên nhóm `principles/`.** Cùng chỗ với các nguyên tắc dựng hình bắt buộc khác, vì độ nổi
  quyết định **cấu trúc** của thứ người dùng nhìn thấy chứ không phải cảm giác của nó. Một bậc sai
  không làm trang xấu đi; nó làm người dùng đọc sai xem cái gì đang chặn cái gì.
- **Bảy mã, chia làm hai nửa.** `ELEVATION-0` … `ELEVATION-3` là một **thang thật**, đánh số theo đúng
  chiều cao tăng dần: nằm trong mặt phẳng, nằm nghỉ trên nền, được gọi ra, chặn cả trang. Đây là nửa
  trả lời *cái gì nằm trên cái gì*, và số của chúng có nghĩa — `3` thật sự ở trên `2`.
  `ELEVATION-4` … `ELEVATION-6` **không phải bậc**: chúng là nửa trả lời *bằng phương tiện nào* — bằng
  một thứ tự viết ra, bằng một đường viền thay cho bóng, bằng cách khoét xuống. Chúng đứng sau vì
  người đọc chỉ cần tới chúng khi thang trần không diễn đạt được tình huống.
- **Tách độ cao khỏi thứ tự.** Bóng nói *cao bao nhiêu so với nền của tôi*; `z` nói *hai thứ chồng
  nhau thì cái nào ở trước*. Gộp hai câu này lại là nguồn gốc của mọi vòng leo số: mỗi tranh chấp
  `z` bị đọc thành "chưa đủ cao", và đáp án luôn là một số to hơn. Sau khi tách, cùng một triệu chứng
  được đọc thành *tổ tiên nào đã đóng ngữ cảnh xếp chồng lại*, và câu hỏi đó sửa được.
- **Ghim `z` vào một thang đóng bảy dòng.** Một bậc âm cho decor và sáu bậc dương, mỗi bậc gắn với
  một loại thứ nó phải vượt qua. Không có bậc giữa hai bậc và không có bậc trên bậc trên cùng, vì một
  số to hơn **không** phải một tuyên bố mạnh hơn: hai tiện ích cùng cơ chế xếp tầng lớp được phân định bằng
  thứ tự nguồn, nên một phần tử đã thua một lần có thể thua lại ở bất kỳ con số nào.
- **Đo bậc từ nền cục bộ.** Đây là luật sâu nhất của mô-đun. Vật chủ đã nâng thì con không nâng nữa;
  một thẻ trong hộp thoại là `ELEVATION-0`. Không có luật này, mọi cây giao diện sâu đều tích luỹ bóng cho tới
  khi không cái bóng nào còn nghĩa gì.
- **Thêm `ELEVATION-6` ngoài bộ hạt giống.** Có những chỗ nền bị **khoét xuống** chứ không được xây
  lên — máng tiến độ, rãnh thanh trượt, nền nhóm nút phân đoạn, ô nhập vẽ như giếng. Chúng không nằm
  trong mặt phẳng của nền, nên không phải `ELEVATION-0`; và chúng không nâng, nên không phải bậc nào
  cả. Không đặt mã thì chúng rơi vào vùng không tên. Mã được thêm ở **cuối** để năm mã hạt giống giữ
  nguyên chỉ số. Lý do và rủi ro nằm ở mục *Rủi ro còn mở* trong `audit.md`.
- **Cố định ba tên bóng và một mức bóng nghỉ.** Một mức cho thứ nằm nghỉ, một cho thứ được gọi ra, một
  cho thứ chặn cả trang. Mức thứ tư là thị hiếu chứ không phải độ cao; yêu cầu "nổi bật hơn" được trả
  lời bằng màu, viền hoặc kích thước.
- **Đóng cửa hiệu ứng.** Độ nổi không đổi vì con trỏ đi qua. Hai ngoại lệ duy nhất — nổi lên khi
  cuộn và nhấc lên khi kéo — được cho phép vì trong cả hai, tuyên bố **trở thành đúng**: có nội dung
  thật chui xuống dưới, hoặc phần tử thật sự đang được giữ trên thứ nó sắp thả xuống.
- **Nhường rõ phần của hàng xóm.** Việc một vùng chứa có được quyền vẽ ranh giới hay không là câu hỏi
  **quan hệ nhóm** và thuộc mô-đun bề mặt; mô-đun này chỉ đọc kết quả đó làm nền cục bộ. Việc phần tử
  còn giữ chỗ trong luồng hay không, và toạ độ của nó thuộc về ai, là câu hỏi **vị trí**; mô-đun này
  không phát ra `relative`, `absolute`, `fixed` hay `sticky` dù mọi mã nâng đều bám vào một trong số
  đó. Màu của bóng và của viền thuộc mô-đun màu sắc. Khoảng cách và khoảng đệm bên trong thuộc các mô-đun khoảng cách.
- **Năm tài liệu, không có `prompt.md`.** Ánh xạ từ yêu cầu bằng lời và bảng phân định ranh giới nằm
  cùng chỗ với những ví dụ mà chúng phân định, trong `example.md`.
