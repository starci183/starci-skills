---
id: fe-patterns-loading-changelog
title: changelog.md
slug: /gates/patterns/loading/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật Loading.
---

# changelog.md

> Current version: `2.00` · Module: `loading`

## Version Policy

Một thay đổi luật được chấp nhận thì tăng cả module thêm `0.01` và cập nhật **năm** record. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc module hoặc shelf mà nó nằm trên.

Mã `LOADING-<n>` **không bao giờ** được đánh số lại và không bao giờ bị gỡ. Các số này đã được trích
dẫn từ file luật khác và từ task record cũ; đánh số lại một mã là bẻ gãy một trích dẫn mà người khác
đã viết ra. Nếu một mã bị cho là sai, nó vẫn ở lại, và chỗ để nói nó sai là **Rủi ro còn mở** trong
[`audit.md`](./audit.md).

## 2.00 — 2026-08-16

Đổi số chính vì hai thứ đổi cùng lúc: shelf và hình dạng module.

- **Chuyển shelf và đổi hình dạng.** Một file luật phẳng `fe/canon/patterns/loading.md` trở thành một
  module năm record ở `gates/patterns/loading/`: `INDEX.md` (máy đọc trước, tiếng Anh), `vi.md` (tình
  huống nghiệp vụ), `example.md` (case và ngoại lệ), `audit.md` (phản biện), `changelog.md`. Toàn bộ
  `id` và `slug` đặt mới theo shelf `patterns`. File luật phẳng không bị xoá và không bị sửa.
- **Giữ nguyên bảy mã.** `LOADING-1` … `LOADING-7` giữ đúng số và đúng nghĩa đã có. Không mã nào được
  thêm, bớt hay đánh số lại. Bảng **Forbidden** của file luật phẳng không mất đi: nó trở thành cột *Forbids*
  của bảng Situation Codes, đứng cạnh cột *Requires*, để mỗi mã nói cả hai vế ở cùng một dòng.
- **Thêm bảng `Tầng giữ`.** Mỗi mã nay khai báo tầng thật đang giữ nó: `unrepresentable`, `enforced`
  hay `documented`. Kết quả là hai mã `enforced` (bởi ba rule của
  [`sources/fe/loading.mjs`](../../../../sources/fe/loading.mjs), gọi đích danh tên rule), một mã
  `unrepresentable`, và **bốn mã `documented`** — tức bốn mã chỉ do người đọc giữ.

  Khoảng trống ấy là **mục đích** của bảng, không phải một thất bại của nó. Một luật không nói tầng
  thì bị đọc như thể enforcement có tồn tại, và người đầu tiên tin cách đọc đó chính là người ship ra
  đúng cái defect mà luật được viết để chặn.

  `LOADING-3` được xếp `unrepresentable` kèm một câu giới hạn ngay tại chỗ: union child-spec làm cho
  việc **khai báo thiếu** số dòng nghỉ trở thành không viết được, nhưng nó không ép những dòng ấy
  hiện ra màn hình. Không làm tròn lên `enforced`, cũng không hạ xuống `documented`.

  `LOADING-5` được xếp `documented` dù `no-resting-branch-at-call-site` có nhắc tới nó: rule đó **miễn
  trừ** nhánh `null` chứ không **đòi** nhánh `null`. Một ngoại lệ bảo vệ dạng đúng khỏi bị báo nhầm;
  nó không phát hiện được dạng sai.
- **Thêm bảng `Anchor`.** Mỗi mã chỉ vào một đường dẫn code thật và làm rõ phải nhìn cái gì ở đó. Cả
  bảy mã đều neo được; không mã nào phải ghi `chưa neo được`. Neo trải trên ba loại bằng chứng khác
  nhau — một leaf, một union kiểu, một file test — và điều đó tự nó nói rằng luật này không chỉ sống
  ở một tầng.
- **Nâng luật thành bắt buộc.** Bổ sung tuyên bố rằng mọi thứ render ra trước khi dữ liệu của nó về
  đều rơi vào một trong bảy mã, và không có surface nào nhỏ tới mức được miễn.
- **Giữ nguyên bảng mối nối hai nửa.** Block sở hữu tình huống, leaf sở hữu dáng nghỉ, và một dòng
  `const isLoading = input.state === "pending"` ở giữa. Đây là quyết định dễ bị bỏ rơi nhất khi tách
  file, nên nó được đặt ngay trong phần `Law` của `INDEX.md` thay vì nằm ở một mục phụ.
- **Đóng năm ngoại lệ.** Twin trong file test, primitive nghỉ dùng chung, control mà bề rộng chính là
  nhãn của nó, dữ liệu đã có trong cache, và nhánh `null`. Bốn cái đầu vốn nằm rải trong comment của
  file luật phẳng và của file lint; nay chúng là ngoại lệ có tên, đóng, và nêu rõ mã mà chúng áp vào.
- **Viết lại `vi.md` theo từng mã.** Mỗi mã có tình huống nghiệp vụ, dấu hiệu nhận biết, câu tự hỏi,
  ranh giới với các mã kề, và danh sách tình huống hay gặp.
- **Viết lại `example.md` cho đủ case.** Mỗi mã nhiều case, từng case đặt bản ĐÚNG cạnh bản SAI, kèm
  mục ngoại lệ và mục "trông giống nhưng không phải mã này". Bốn ví dụ của file luật phẳng được giữ lại
  nguyên ý và viết lại bằng TSX tổng quát.
- **Rút mọi ví dụ về TSX thuần.** Bỏ mọi tên sản phẩm, tên repository và tên component library. Bản
  phẳng có nêu đường dẫn neo kèm tên repository; bản này giữ đường dẫn và bỏ tên repository, vì một
  luật ở shelf này phải đúng với bất kỳ front end nào.
- **Không có `prompt.md`.** Ánh xạ yêu cầu và bảng phân định ranh giới nằm cùng chỗ với những ví dụ mà
  chúng phân định. Module có đúng năm record.

## Các phiên bản trước

`1.x` sống dưới dạng một file luật phẳng ở `fe/canon/patterns/loading.md`: bảy rule đánh mã, một bảng
**Forbidden**, một bảng mối nối hai nửa, bốn cặp ví dụ, và một dòng trỏ sang file lint giữ luật. File
đó vẫn còn nguyên; bản `2.00` này diễn đạt lại nó đầy đủ hơn chứ không thay thế một quyết định nào
của nó.
