---
id: fe-layouts-laws-l10-region-width-belongs-to-its-owner-changelog
title: changelog.md
slug: /fe/layouts/laws/l10-region-width-belongs-to-its-owner/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật L10.
---

# changelog.md

> Phiên bản hiện tại: `1.00` · Mô-đun: `l10-region-width-belongs-to-its-owner`

## Quy tắc phiên bản

Một thay đổi luật được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Thêm
một mã tình huống là bump nhỏ. Đổi câu `Law` là bump lớn cho cả kệ, vì [`l9`](../l9-sticky-offset-is-page-local/INDEX.md)
phán chỗ dừng của cùng những vùng này và đọc L10 để biết chúng rộng bao nhiêu.

## Nghiệm thu — 2026-08-17

Đợt kiểm sau khi lập mô-đun. Không đổi câu `Law`, không thêm bớt mã tình huống, nên **không bump
phiên bản**.

- **Ghi một mâu thuẫn chéo với `L9`** vào [`audit.md`](./audit.md), ghi đối xứng bên ấy. Cùng một
  selector `md:[&>*:last-child]` tại `contracts\index.ts:1956-1959` mang cả `w-72` lẫn
  `sticky top-rail max-h-rail overflow-y-auto`, nên khi đích của nó sai thì cả hai luật cùng sai một
  lượt — `L10` đã gọi đó là vi phạm, `L9` vẫn đang đếm nó vào phần "đang tuân".
- **Xác nhận vi phạm đang chạy bằng mã sống.** `outline` khai `optional: true` tại `index.ts:1964`
  và `CourseLearnContentPage\component.tsx:540` bỏ slot ấy khi không có heading, nên ở trạng thái đó
  cột đọc `main` nhận nguyên cụm rail. Kiểm lại đúng như `audit.md` đã ghi.
- **Trỏ tiêu chí hình dạng điều khiển sang đúng chủ.** Ngoại lệ "A control's own width" gửi tiêu chí
  sang [`l4`](../l4-tab-switches-panel-route-switches-page/INDEX.md) vì nó được viết khi `L11` còn là
  một hàng `owed`. Tiêu chí ấy nay có mô-đun riêng, nên câu này trỏ sang
  [`l11`](../l11-full-width-run-versus-compact-control/INDEX.md). `L10` vẫn không được trả lời nó
  bằng cách suy từ một rail.

## 1.00 — 2026-08-17

Mô-đun được lập lần đầu trên kệ `fe/layouts/`, từ sáu dòng từ chối trên bốn hồ sơ và từ một lần đo
toàn bộ registry contract của repo sống.

- **Phát biểu luật theo chủ, không theo class.** Bản nói miệng trước đây là "đừng để vùng con tự đặt
  chiều rộng", và nó không đủ để chặn lần sửa nhầm đã xảy ra: người sửa không để vùng con tự đặt gì
  cả, họ sửa đúng một layout owner, chỉ là sai người. Câu mới bắt gọi tên chủ hàng và bắt liệt kê mọi
  chủ cùng hình dạng trước khi sửa.
- **Đặt sáu mã tình huống.** `L10-1` đến `L10-6`, trong đó `L10-5` và `L10-6` phát ra **không gì cả**
  mà vẫn là tình huống được phân loại.
- **Tách "nhắm vào danh tính" thành mã riêng.** `L10-2` sinh ra từ dòng bác selector theo vị trí của
  Global Search. Nó không phải một mẹo cho React Aria, mà là hệ quả chung của việc contract có con
  `optional` và con `repeats`, nên nó cần một mã chứ không phải một ghi chú.
- **Từ chối trả lời chiều rộng của một điều khiển.** Thầy đã ra phán quyết cả hai chiều trên thanh
  chọn năm của dashboard: `dashboard-contribution-primary-tabs.md:82` bắt nó chạy dài hết dòng như
  ShellNav, rồi `:291` lật lại về số đo nội tại vì nó là tham số của một khối chứ không phải điều
  hướng vùng. Bản cũ của luật sẽ trả lời câu này theo phép loại suy với rail và sẽ sai một trong hai
  lần. Tiêu chí được đẩy sang [`l4`](../l4-tab-switches-panel-route-switches-page/INDEX.md) và L10
  ghi rõ là không phán.
- **Công nhận `L10-5` thay vì gọi nó là vi phạm.** `profile-identity-rail` tự khai `@app-md:w-72`.
  Một bản luật tuyệt đối sẽ bắt sửa chỗ này, nhưng chủ hàng của nó không phát chiều rộng nào, nên sửa
  đi sẽ để lại một hàng không ai giữ số đo. Luật chuyển quyền sở hữu thay vì cấm.
- **Ghi bốn khoản nợ đo được** vào [`audit.md`](./audit.md) thay vì để luật nói như thể chúng đã
  xong: selector vị trí trên con optional ở `content-reader-frame`, selector vị trí trên con lặp ở
  `personal-project-workspace-frame`, `why` cũ của `nav-over-body-page`, và việc bảng định tuyến của
  kệ vẫn ghi chủ của L10 là `destination-column`.
