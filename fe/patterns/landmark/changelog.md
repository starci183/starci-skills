---
id: fe-patterns-landmark-changelog
title: changelog.md
slug: /fe/patterns/landmark/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật Landmark.
---

# changelog.md

> Current version: `2.00` · Module: `landmark`

## Version Policy

Một thay đổi luật được chấp nhận thì tăng cả module thêm `0.01` và cập nhật **năm** record. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc module hoặc shelf mà nó nằm trên.

## 2.00 — 2026-08-16

Đổi số chính vì hình dạng của module đổi, không phải vì luật đổi. **Không mã nào bị đổi số, đổi nghĩa,
thêm vào hay bỏ đi.**

- **Từ một file luật phẳng thành module năm record.** `fe/canon/patterns/landmark.md` được diễn đạt
  lại thành `fe/patterns/landmark/` với `INDEX.md`, `vi.md`, `example.md`, `audit.md`, `changelog.md`.
  File phẳng vẫn còn nguyên tại chỗ cũ; module này không xoá và không sửa nó.

- **Thêm bảng `Tầng giữ`.** Mỗi mã nay khai báo thẳng ai đang giữ nó: `unrepresentable`, `enforced`,
  hay `documented`. Kết quả đo được là hai mã `enforced` (`LANDMARK-4` bởi
  `routed-page-is-a-main-landmark`, `LANDMARK-5` bởi `main-landmark-belongs-to-a-route-file`), một mã
  `unrepresentable` (`LANDMARK-3`, nhờ props đóng của branch vẽ node), và hai mã `documented`
  (`LANDMARK-1`, `LANDMARK-2`).

  Khoảng trống ấy là **điểm** của bảng chứ không phải khuyết điểm của nó. File luật phẳng đã tự nói
  "luật này không giữ được trường hợp xuyên file"; bảng chỉ mở rộng sự thành thật đó xuống từng mã,
  để không ai đọc một mã rồi tưởng có cổng đang canh.

- **Thêm bảng `Anchor`.** Mỗi mã trỏ vào code thật và nói rõ phải nhìn cái gì ở đó. Ba mã neo được
  (`LANDMARK-3`, `LANDMARK-4`, `LANDMARK-5`). Hai mã ghi `chưa neo được trong ứng dụng`
  (`LANDMARK-1`, `LANDMARK-2`): ứng dụng đã bỏ hẳn branch landmark và chuyển element sang entry, nên
  không còn branch nào để trỏ tới; neo còn lại chỉ ở phía lint. Cả hai được ghi vào "Rủi ro còn mở".

- **Viết lại `vi.md` theo từng mã.** Mỗi mã có tình huống, dấu hiệu nhận biết, câu tự hỏi, ranh giới
  với mã kề, và danh sách tình huống nghiệp vụ hay gặp.

- **Viết lại `example.md` cho đủ case.** Mỗi mã nhiều case, mỗi case có ĐÚNG và SAI đặt cạnh nhau, kèm
  mục ngoại lệ và mục "trông giống nhưng không phải mã này". Cuối trang là ánh xạ yêu cầu, bảng phân
  định ranh giới và danh sách sai lầm lặp lại.

- **Rút mọi ví dụ về TSX thường.** Tên component và tên key riêng của một sản phẩm được tổng quát hoá
  và khai báo thẳng là minh hoạ. Một luật ở shelf này phải đúng với bất kỳ front end nào dựng node từ
  registry.

- **Ghi nhận một sai lệch về số lượng mã.** Bản mô tả công việc nói module có sáu mã; luật gốc có năm.
  Đếm được sáu là do năm mã trong file luật cộng một lần tham chiếu ngược trong `sources/fe/landmark.mjs`.
  Module kết thúc ở **năm**, vì thêm `LANDMARK-6` để khớp con số đếm là bịa ra luật chứ không phải
  diễn đạt lại luật. Sai lệch nằm ở `audit.md`, cùng ứng viên duy nhất nếu sau này thật sự cần đánh số
  một quyết định thứ sáu.
