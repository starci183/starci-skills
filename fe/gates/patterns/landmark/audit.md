---
id: fe-patterns-landmark-audit
title: audit.md
slug: /gates/patterns/landmark/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định, tầng giữ và khả năng neo được của luật Landmark.
---

# audit.md

> Version: `2.00` · Module: `landmark`

Audit này kiểm hai thứ: luật có chọn được **một file và một vật mang** từ vai trò đã nêu hay không, và
mỗi mã có thật sự được giữ ở tầng mà bảng `Tầng giữ` khai báo hay không.

## Verdict

Chấp nhận, **kèm một sai lệch đã ghi nhận**: bản mô tả công việc nói module này có sáu mã, luật gốc có
năm. Xem "Rủi ro còn mở". Không mã nào bị đổi số, không mã nào bị thêm.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `LANDMARK-1` vs `LANDMARK-3` | Loại trừ được: một bên đếm branch, một bên hỏi ai chọn element |
| `LANDMARK-1` vs `LANDMARK-2` | Loại trừ được khi đã nêu branch mới mang thêm gì ngoài element |
| `LANDMARK-2` vs `LANDMARK-3` | Loại trừ được: mất truy nguyên khác mất ý nghĩa document |
| `LANDMARK-4` vs `LANDMARK-5` | Loại trừ được: một bên bắt buộc, một bên cấm, và hai tập file khác nhau |
| `LANDMARK-5` — branch vs entry host | Loại trừ được khi đã nêu có ai import landmark hay không |
| `LANDMARK-5` — trang vs cột đọc | Loại trừ được khi đã nêu bỏ node đi thì mất cả trang hay mất một cột |
| Thiếu vai trò file | Hỏi **một** câu: file này sở hữu cả màn hình hay một phần của nó |

## Findings

- **Tên key đã bị loại hẳn khỏi tập tiêu chí.** Đây là phát hiện gốc của cả module: một key tên
  `dashboard-main` từng được đọc thành landmark, và cách chữa không phải đổi tên key mà là tuyên bố
  rằng chỉ `host` đã khai báo mới là lời hứa.
- **Hai vật mang được giữ ở hai tập file khác nhau, và việc gộp chúng lại từng là khuyết tật thật.**
  Giữ cả hai về file route khiến luật này và luật bố cục file từ chối lẫn nhau: mọi trang chuyển ra
  khỏi cây route đều bị báo đặt sai landmark, và cách duy nhất thoả mãn cả hai là để người sở hữu
  trang nằm lại trong cây route — đúng khuyết tật mà luật bố cục sinh ra để ngăn.
- **Phép thử "dựng chrome" hẹp hơn "có `children`" một cách có chủ đích.** Bản rộng bắt cả layout gốc
  lẫn layout trung chuyển, và thoả mãn chúng sẽ đặt `main` thứ hai vào document. Độ thô ấy đã đo được,
  không phải suy đoán.
- **Bề mặt trang được nhận entry khai host là hệ quả của một sửa sai, không phải nới lỏng.** Bảo đảm
  không đổi: một `main` cho mỗi document, thuộc về người sở hữu cả màn hình. Chỉ tập file thoả mãn
  được câu đó là rộng ra.
- **Ứng dụng đang chạy đã bỏ hẳn branch landmark.** Element nay đến từ entry, nên `LANDMARK-1` và
  `LANDMARK-2` mất neo phía sản phẩm dù vẫn còn neo phía lint. Đây không phải luật sai; đây là luật
  hiện không có ai để kiểm chứng.

## Decisions

- Giữ đúng năm mã: `LANDMARK-1`, `LANDMARK-2`, `LANDMARK-3`, `LANDMARK-4`, `LANDMARK-5`. Không đổi số,
  không đổi nghĩa, không thêm mã thứ sáu để khớp một con số đếm.
- Giữ nguyên hai ngoại lệ của `LANDMARK-4` (layout gốc, layout trung chuyển) và ngoại lệ file cài đặt
  của `LANDMARK-1`.
- Giữ nguyên tuyên bố "luật này không giữ được trường hợp xuyên file" như một phần của luật.
- Ghi tầng giữ đúng như đo được, kể cả khi kết quả là hai mã chỉ có người đọc giữ.
- Giữ mọi ví dụ ở dạng TSX thường, không tên sản phẩm, không tên repository.

## Rủi ro còn mở

- **Bản mô tả công việc nói sáu mã; luật gốc có năm.** Đếm được sáu là do năm mã trong file luật cộng
  một lần tham chiếu ngược trong file lint. Bịa ra `LANDMARK-6` để khớp con số đếm là **bịa ra luật**,
  nên module này kết thúc ở năm. Nếu quả thật có một quyết định thứ sáu cần đánh số, ứng viên duy nhất
  đọc được từ luật gốc là dòng "landmark viết tay" trong bảng Forbidden — hiện đang nằm trong
  `Invariants` và trong `LANDMARK-1` của `example.md`. Đánh số nó là một rule change, và phải đi qua
  `changelog.md`.

- **`LANDMARK-1` chỉ ở tầng `documented`.** Để giữ được, một rule sẽ phải thấy: **tập hợp** các branch
  đang tồn tại, element mà mỗi branch mở, và element mà mỗi entry yêu cầu — rồi báo khi một element
  được yêu cầu mà không branch nào mở nó, hoặc khi hai branch cùng mở một element. Đó là một phép đo
  toàn dự án, không phải một phép đo từng file; lint chạy theo file nên không đứng đúng chỗ để làm.

- **`LANDMARK-2` chỉ ở tầng `documented`.** Để giữ được, rule sẽ phải phân biệt một prop **mang class**
  với một prop **mang nội dung**, trên một branch mà nó chỉ nhận ra qua tên thư mục. Nhận diện bằng
  đường dẫn sẽ bắn cả vào branch thường — file mà chính luật này bảo phải giống hệt branch landmark.
  Một phép thử không phân biệt được hai thứ mà luật cố tình làm cho giống nhau thì không phải phép thử.

- **`LANDMARK-1` và `LANDMARK-2` hiện `chưa neo được trong ứng dụng.`** Không còn branch landmark nào
  trong sản phẩm để trỏ tới; neo duy nhất là tập `LANDMARK_BRANCHES` trong lint và branch thường mà
  branch landmark lẽ ra phải giống. Theo luật cao nhất của canon, một luật không trỏ được vào code
  thật là một **đề xuất**, không phải một luật. Hai mã này đang ở tình trạng đó ở phía sản phẩm và
  được giữ lại nguyên văn vì lint vẫn nhận diện shape ấy — nghĩa là ngày nào một repository dựng lại
  branch landmark, luật đã có sẵn ở đó. Nếu qua một chu kỳ nữa vẫn không có ai neo được, câu hỏi đúng
  là **rút hai mã**, không phải làm ngơ chúng.

- **`LANDMARK-3` được ghi là `unrepresentable` nhờ một interface đóng, không phải một union.** Không ai
  viết được `as` vào call site, nhưng có người **sửa được interface** để thêm nó vào. Bảo đảm này mạnh
  đúng bằng việc props của branch còn đóng, và không có rule nào canh cửa đó.

- **Trường hợp xuyên file vẫn mở, và cố ý mở.** Một layout mở landmark và một trang bên dưới nó cũng
  mở landmark là hai file hợp lệ riêng lẻ. Bịt lỗ này cần một phép đo theo cây route đã render, không
  phải theo file.

## Re-audit Triggers

- Một repository dựng lại branch landmark, hoặc thêm một element landmark thứ hai.
- Có đề xuất thêm `as`, `element` hay `tag` vào props của branch vẽ node.
- Một entry khai `host: "main"` cho một key đang mô tả một phần của màn hình.
- Một màn hình được phát hiện có hai `main`, tức trường hợp xuyên file đã xảy ra thật.
- Tập file được `LANDMARK-5` chấp nhận đổi lần nữa, hoặc luật bố cục file đổi định nghĩa file route.
- Một ví dụ trong `example.md` cần tên riêng của một sản phẩm mới đọc được.
