---
id: fe-layouts-laws-l5-every-route-has-a-real-owner-changelog
title: changelog.md
slug: /fe/layouts/laws/l5-every-route-has-a-real-owner/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật L5.
---

# changelog.md

> Phiên bản hiện tại: `1.00` · Mô-đun: `l5-every-route-has-a-real-owner`

## Quy tắc phiên bản

Một thay đổi luật được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Thêm
một mã tình huống là bump nhỏ. Đổi câu `Law`, hoặc gắn một mặc định vào `L5-5`, là bump lớn cho cả
kệ, vì `destination-column` rẽ vào đây qua `SPINE-6`.

## Nghiệm thu — 2026-08-17

Đợt kiểm sau khi lập mô-đun. Không đổi câu `Law`, không thêm bớt mã tình huống, nên **không bump
phiên bản**.

- **Sửa một neo lệch dòng trong [`INDEX.md`](./INDEX.md).** Hàng "A `L5-6` casualty: the orphaned
  contract key" neo vào `contracts\index.ts:293`, nhưng `:293` là slot `subtitle` bên trong contract
  chứ không phải khoá. Khoá `"course-learn-today-page"` nằm ở `:289`. Neo đã chuyển về `:289`.
- **Kiểm hai phán quyết trái chiều.** Cả hai còn nguyên và khớp nguyên văn: vòng A ở
  `learn-branch.md:1858` và `:2109`, vòng B ở `learn-legacy-ai-policy.md:79` và `:159`. Số đếm 51
  file `page.tsx`, 3 redirect được đo lại và đúng.

## 1.00 — 2026-08-17

Mô-đun được lập lần đầu trên kệ `fe/layouts/`, từ mười một dòng từ chối trên hai hồ sơ và từ một lần
quét toàn bộ 51 file route của repo sống.

- **Viết `L5` thành tiêu chí phân loại, không thành một giá trị.** Bản trước của ý này nằm rải trong
  các phán quyết và bị đọc thành "route phải có trang". Đọc như vậy thì cú lật vòng hai trở thành
  một lần vi phạm, trong khi nó là một quyết định sản phẩm hợp lệ. Bản này tách hai câu ra: route
  mang nội dung thì phải có owner, còn cửa nào mở sang đâu thì luật không trả lời.
- **Vì sao bản cũ bị bác: nó gộp lần bác stub với cú lật về cửa vào.**
  `.workflows\designs\starci-academy\learn-branch.md:495` bác việc dựng stub, còn
  `.workflows\fidel\starci-academy\learn-legacy-ai-policy.md:79` lật đích của `/learn`. Hai dòng ấy
  nói về hai chuyện khác nhau, nên đặt chúng làm "ruling A" và "ruling B" của cùng một tiêu chí sẽ
  giấu mất cặp thật sự ngược chiều là `…\learn-branch.md:1858` cùng `:2109` đối với
  `…\learn-legacy-ai-policy.md:79` cùng `:159`. Cặp thứ hai này chưa từng được neo ở đâu trên cây
  trust trước bản này.
- **Đặt sáu mã tình huống.** `L5-1` đến `L5-6`, trong đó `L5-4` phát ra **không gì cả**, `L5-5` phát
  ra **một câu hỏi**, và cả hai vẫn là tình huống đã được phân loại chứ không phải chỗ trống.
- **Tách cửa vào thành hai mã theo nguồn của đích.** `L5-2` tính đích từ params nên không có owner;
  `L5-3` phải hỏi runtime nên buộc phải là một trang. Trước đây cả hai bị gọi chung là "redirect", và
  cách gọi đó không giải thích được vì sao `/profile` có owner còn `/learn` thì không.
- **Đo lại thay vì suy.** 51 file `page.tsx`, 48 mount owner, 3 redirect, 0 khác. Con số này thay
  cho mọi câu định tính về việc repo có tuân hay không.
- **Ghi ba khoản nợ đo được vào `audit.md`** thay vì để luật nói như thể chúng đã xong: owner mồ côi
  `CourseLearnTodayPage` cùng ba thứ chết theo, việc không gate nào hỏi được route nào mount một
  trang, và việc bảng định tuyến của kệ chưa biết đến thư mục `laws/`.
- **Ghi thẳng chỗ lệch với `SPINE-6`** vào `audit.md` thay vì im lặng chọn một bên. Kết luận về repo
  thì hai bên khớp, cách đặt tên hai phán quyết thì không, và đó là finding phải hoà giải.
