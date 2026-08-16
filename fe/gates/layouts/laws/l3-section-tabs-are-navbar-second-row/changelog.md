---
id: fe-layouts-laws-l3-section-tabs-are-navbar-second-row-changelog
title: changelog.md
slug: /gates/layouts/laws/l3-section-tabs-are-navbar-second-row/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật L3.
---

# changelog.md

> Phiên bản hiện tại: `1.00` · Mô-đun: `l3-section-tabs-are-navbar-second-row`

## Quy tắc phiên bản

Một thay đổi luật được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Thêm
hoặc bỏ một mã `L3-` là bump nhỏ. Đổi bốn tiêu chí trong câu `Law` là bump lớn cho cả kệ, vì `L9`
lấy số hàng mà luật này chốt để dựng token offset của nó. Đọc thêm một dòng từ chối mà nó **xác nhận**
một mã đã có thì không phải thay đổi luật.

## Nghiệm thu — 2026-08-17

Đợt kiểm sau khi lập mô-đun. Không đổi câu `Law`, không thêm bớt mã tình huống, nên **không bump
phiên bản**.

- **Sửa một liên kết gắn nhầm đích trong [`INDEX.md`](./INDEX.md).** Câu "Whether a control is a
  section tab at all belongs to `L4`" mang chữ hiển thị là `L4` nhưng trỏ sang
  `../../sticky-chrome-band/INDEX.md`. Nay trỏ đúng vào
  [`l4-tab-switches-panel-route-switches-page`](../l4-tab-switches-panel-route-switches-page/INDEX.md).
  `sticky-chrome-band` vẫn giữ `CHROME-3` và `CHROME-4`, nên đây là sửa đích chứ không phải chuyển
  chủ.
- **Kiểm lại toàn bộ neo.** Bảy neo từ chối được mở đúng dòng và khớp nguyên văn cột `Why`; mọi neo
  code mở được trong `D:\Repositories\starci-academy-fe` nhánh `main`. Không neo nào trỏ vào repo
  `starci-academy` cũ.

## 1.00 — 2026-08-17

Mô-đun được lập lần đầu trên kệ `gates/layouts/`, từ bảy dòng từ chối trên hai hồ sơ và từ một lần đọc
lại toàn bộ ba cơ chế tabs đang sống trong repo.

- **Phát biểu luật ở dạng kết quả kiểm được, không ở dạng danh sách class.** Bốn tiêu chí đo trên một
  lần render: dính, cùng ghim, một nét kẻ, một baseline rộng bằng navbar. Bản này chọn cách đó vì bốn
  trong bảy lần bác không xảy ra ở ảnh chụp đầu trang mà xảy ra lúc cuộn hoặc lúc soi chỗ giáp, nên
  một luật viết bằng class sẽ được tuyên bố là đã đạt trước khi nó thật sự đạt.
- **Đặt bảy mã tình huống.** `L3-1` đến `L3-7`, trong đó `L3-3` phát ra **không gì cả** và vẫn là một
  tình huống được phân loại, còn `L3-7` chỉ tồn tại để đẩy việc sang `L4`.
- **Tách cơ chế khỏi kết quả.** `L3-1` và `L3-2` là hai đường khác nhau tới cùng bốn tiêu chí, và
  ranh giới giữa chúng là một dữ kiện về dữ liệu chứ không phải một sở thích: layout của cụm có gọi
  tên được tập mục mà không cần dữ liệu của trang hay không.
- **Ghi chi phí của `L3-2` thay vì giấu nó.** Chi tiết khoá học có hai landmark điều hướng chồng lên
  nhau ở chỗ dashboard chỉ có một. Bản này chấp nhận đường đó nhưng ghi cái giá vào `audit.md`, và
  không cho phép nới lỏng seam để đổi lấy nó.
- **Viết `L3-5` ở dạng "bỏ token nào", không phải "bỏ hàng nào".** Đây là chỗ thầy tự lật. Vòng một
  bác việc lặp `Trang chủ / Khóa học / Liên hệ` trên hàng chính, và người làm hiểu là gỡ ba route link
  đi. Vòng hai bác luôn cách hiểu đó với câu `nhầm không phải bỏ nội dung, mà là bỏ icon`. Bản cũ của
  cách hiểu này bị bác vì nó nhảy từ "có thứ nói hai lần" sang "vậy thì bỏ hàng trên" mà không dừng
  lại gọi tên thứ đang nói hai lần. Luật giờ bắt gọi tên token trước, rồi hỏi, rồi mới sửa.
  Neo vòng một: `.workflows\fidel\starci-academy\courses-runtime-projection-i18n-20260815-01.md:521`.
  Neo vòng hai: cùng hồ sơ, `:598`.
- **Thêm `L3-6` cho chuyện bằng chứng, không cho chuyện cấu trúc.** Một proof cũ chứng minh tabs đã
  sát navbar từng được dẫn ra để tuyên bố seam đã sạch, và người đọc vẫn thấy divider. Mã này bắt hai
  giá trị border thật trên route, và cho phép ghi thẳng `chưa đo`.
- **Chốt rằng breadcrumb không phải một bản lặp của tabs.** Việc gỡ breadcrumb vì đã có tabs từng bị
  bác thẳng, nên nó vào `Exceptions` chứ không thành một mã.
- **Ghi ba khoản nợ đo được** vào `audit.md` thay vì để luật nói như thể chúng đã xong: hàng tabs
  không ghim ở cụm `profile` mà chưa có phán quyết nào phủ tới, hai landmark `nav` chồng nhau ở chi
  tiết khoá học, và một mục `Live breaches` trên kệ đang dựa vào vòng đã bị lật.
- **Sửa hai neo sai số dòng.** Bằng chứng đầu vào ghi hai câu lật ở `:1367` và `:1444` của hồ sơ
  runtime, nhưng file dài 605 dòng và hai hàng `REJECTED` thật nằm ở `:521` và `:598`. Mô-đun neo vào
  hai dòng đã mở ra đọc lại.
