---
id: fe-lints-vendor-boundary-changelog
title: changelog.md
slug: /gates/lints/vendor-boundary/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của hồ sơ thi hành luật ranh giới thư viện ngoài.
---

# changelog.md

> Phiên bản hiện tại: `2.00` · Mô-đun: `vendor-boundary`

## Quy ước phiên bản

Một thay đổi được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu cùng lúc.
Đổi số chính (`x.00`) dành cho thay đổi hình dạng mô-đun hoặc kệ mà nó nằm trên.

Mô-đun này có một luật phiên bản riêng, khác với các kệ nói về **luật**: hồ sơ ở đây mô tả **mã đang
chạy**, nên nó cũ đi mỗi khi nguồn đổi, kể cả khi luật không đổi một chữ nào. Ba loại thay đổi bắt
buộc tăng phiên bản:

1. Nguồn thêm, bớt hoặc **đổi tên** một rule — vì tên công bố chính là danh tính.
2. Một cơ chế phát hiện đổi (node được thăm, biểu thức đường dẫn, phép so chuỗi).
3. Một **cửa còn mở** bị đóng, hoặc một cửa mới được tìm ra.

Đóng một cửa mở mà không chuyển dòng tương ứng từ bảng **Open** sang bảng **Closed** là một thay đổi
chưa hoàn tất, không phải một thay đổi nhỏ.

## 2.00 — 2026-08-16

Dựng mới. Mô-đun này được tạo để ghi lại **việc thi hành**, không phải luật: máy nhìn thấy được gì
của luật ranh giới thư viện ngoài, bằng cơ chế nào, và — phần thường không ai viết ra — **không nhìn
thấy gì**.

- **Đặt kệ `lints/`.** `principles/` và `patterns/` ghi luật; `lints/` ghi mức thi hành. Năm tài
  liệu, không có `prompt.md`.
- **Danh tính là tên rule đã công bố.** Mỗi mục mang đúng tên rule, nguyên văn, kể cả khi tên chứa
  một từ sản phẩm — đó là chuỗi mà bản build in ra và là chuỗi nằm trong comment tắt luật. Không gán
  mã số thứ hai cho rule.
- **Phủ 10 rule** do nguồn công bố, đóng gói trong `@starci/eslint-canon-fe` dưới tiền tố
  `starci-fe/`: `vendor-boundary`, `modal-shell-owns-scroll-body`,
  `field-input-uses-secondary-variant`, `field-label-is-text-only`, `no-surface-branch-in-overlay`,
  `text-link-uses-hero-link`, `account-control-owns-dropdown`,
  `auth-overlay-owns-single-content-host`, `checkbox-keeps-compound-anatomy`,
  `no-internal-starci-href`. Cả 10 ánh xạ được vào một mã luật có thật; một rule giữ hai mã.
- **Ghi hai mã luật không được giữ.** `VENDOR-3` và `VENDOR-4` không có rule nào và nằm ở "Rủi ro
  còn mở", không được vá bằng một ánh xạ bịa. `VENDOR-5` là uỷ quyền có chủ ý cho mô-đun biểu tượng,
  không tính là hở.
- **Bảng `Detection` đọc từ thân rule.** Loại node, biểu thức tên file, phép so chuỗi, đường dẫn
  import, tên thẻ JSX — ghi cụ thể, vì không có bảng này thì không viết nổi bảng sau nó.
- **Bảng `Escape Hatches` tách làm hai.** **Closed**: lối viết tưởng lọt mà không lọt, kèm lý do.
  **Open**: **31 dòng** lối viết mà rule thật sự không bắt, mỗi rule ít nhất một dòng, không dòng
  nào ghi "không có". Bốn dạng lặp lại nhiều nhất là hằng số rửa sạch chuỗi, cổng tên file, cổng thư
  mục thay cho cổng file, và mảng/object đứng ngoài node được thăm.
- **Ghi 14 nhận định trong `audit.md`**, trong đó: danh sách vỏ trong mã nhận **bốn** trong khi văn
  bản luật viết **ba**; nhận diện thư viện ngoài không nhất quán giữa bốn rule cùng một file nguồn;
  và bốn rule hành xử rộng hoặc hẹp hơn điều tên gọi gợi ra.
- **Ví dụ viết bằng mã thật**, hơn 40 khối, mỗi rule có vài cặp SAI/ĐÚNG cộng một mục chứa **mã đi
  lọt** — dán nhãn rõ là thứ rule bỏ sót, không phải thứ được phép viết.
- **Không nêu tên sản phẩm trong prose và ví dụ.** Gói thư viện ngoài viết là `@vendor/react` /
  `<tiền-tố-vendor>`. Định danh ship thật — tên rule, `messageId`, tên thành viên JSX được so chuỗi —
  giữ nguyên văn, vì đó là thứ máy in ra.
