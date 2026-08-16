---
id: fe-layouts-laws-l4-tab-switches-panel-route-switches-page-changelog
title: changelog.md
slug: /gates/layouts/laws/l4-tab-switches-panel-route-switches-page/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật L4, kể cả vòng phán quyết đã bị chính thầy lật.
---

# changelog.md

> Phiên bản hiện tại: `1.00` · Mô-đun: `l4-tab-switches-panel-route-switches-page`

## Quy tắc phiên bản

Một thay đổi luật được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Thêm
hoặc bỏ một mã `L4-` là bump nhỏ. Đổi câu `Law` là bump lớn cho cả kệ, vì
[`sticky-chrome-band`](../../archetypes/sticky-chrome-band/INDEX.md) `CHROME-5` và bảng điểm trong
[`proofs/`](../../proofs/INDEX.md) đều rẽ vào đây. Một trang thứ hai dùng `L4-2` cũng là thay đổi
luật, vì nó kiểm xem việc navbar giữ từ vựng panel là một cái tật hay là một hình dạng hợp lệ thứ
hai.

## Nghiệm thu — 2026-08-17

Đợt kiểm sau khi lập `l11`. Không đổi câu `Law`, không thêm bớt mã tình huống, nên **không bump
phiên bản**.

- **Ngoại lệ "A parameter control that the founder called primary" không còn tự nhận đã chốt tiêu
  chí.** Câu cũ viết "Ruled both ways and settled at `L4-4`", đọc như thể `L4` là nơi phân xử hình
  dạng của điều khiển. `L4-4` vẫn phán đúng phần của nó — hierarchy không đẩy một tham số của khối
  lên thành vùng nội dung của trang — nhưng tiêu chí hình dạng nay nằm ở
  [`l11`](../l11-full-width-run-versus-compact-control/INDEX.md) và `L4-4` chỉ đọc kết quả. Chỗ trỏ
  sai này do chính [`audit.md` của `l11`](../l11-full-width-run-versus-compact-control/audit.md) đo
  ra.

## 1.00 — 2026-08-17

Mô-đun được lập lần đầu trên kệ `gates/layouts/laws/`, từ sáu dòng từ chối trên ba hồ sơ và từ một lần
đo mọi điều khiển đang chạy trong repo sống `D:\Repositories\starci-academy-fe` nhánh `main`.

- **Tách "cái nút này quan trọng đến đâu" khỏi "cái nút này đổi cái gì".** Đây là lý do bản cũ bị
  lật, chép nguyên vòng phán quyết ở mục dưới.
- **Đặt bảy mã tình huống.** `L4-1` đến `L4-7`, trong đó `L4-7` phát ra **không gì cả** và vẫn là một
  tình huống được phân loại, vì "chưa ai nói panel này có gửi được không" là câu hỏi cho thầy chứ
  không phải khoảng trống cho người viết mã tự điền.
- **Tách khả năng gửi link thành một input riêng.** `shareability` không suy được từ cây component,
  bởi `L4-2` và `L4-3` dựng bằng cùng một họ leaf và trông y hệt nhau. Repo sống có cả hai câu trả
  lời và mỗi câu đều do một phán quyết riêng, nên không câu nào là mặc định.
- **Tách `L4-5` ra khỏi `L4-2`.** Bốn nút section trên trang chi tiết khoá học nằm trong một dải
  chrome rộng hết chiều ngang y như dashboard, nhưng handler của chúng chỉ cuộn. Nếu không có mã
  riêng thì một người đọc contract sẽ xếp chúng vào `L4-2` và đi thêm một query param không ai cần.
- **Thêm `L4-6` cho cặp preview và commit.** Từ dòng bác ở Global Search: điều hướng ngay khi chọn
  hàng thì panel chi tiết không bao giờ đọc được.
- **Ghi bốn khoản nợ đã đo** vào [`audit.md`](./audit.md) thay vì để luật nói như thể chúng đã xong:
  navbar giữ từ vựng panel của dashboard, `L4-5` gọi đích theo thứ tự, `TODAY_TABS` không route nào
  chạm tới, và không có dấu hiệu máy đọc được để tách `L4-2` khỏi `L4-5`.

### Vòng phán quyết đã bị lật

Cả hai vòng nằm trong cùng một hồ sơ,
`.workflows\fidel\starci-academy\dashboard-contribution-primary-tabs.md`, và cả hai đều còn hiệu lực
theo đúng nghĩa của chúng.

| Vòng | Bác | Chọn | `Why` nguyên văn | Neo |
|---|---|---|---|---|
| A | Intrinsic secondary year control at the row end | Full-width primary underline run | "User: “nó phải là 1 line dài như shellnav”." | `:82` |
| B | Treat year parameter as ShellNav-level navigation | Compact control beside the plot summary | "It changes one visualization parameter, not the page's content region." | `:242` |
| B | Full-width underline years | Intrinsic segmented years | "The former is secondary region navigation, not a local calendar parameter." | `:291` |

Vòng A nói về **cách vẽ**: thầy muốn điều khiển chọn năm được nhìn nhận là chính chứ không phải phụ,
và HeroUI gọi lớp sơn gạch chân của nó là `secondary` nên tên vendor và ý sản phẩm đá nhau. Trò sửa
đúng theo lời, kéo dải chọn năm thành một hàng rộng hết cột.

Vòng B bác chính kết quả đó, và lý do không phải thầy đổi ý về tầm quan trọng mà là về **vai trò**.
Một hàng gạch chân rộng hết cột được đọc như điều hướng vùng, còn cái nút này chỉ đổi một tham số của
một hình vẽ. Chính hồ sơ ghi lại sự lật ấy ở một dòng `WARNINGS`, không phải dòng `REJECTED`:

> "Earlier session evidence called a full-width underline “primary”. This feedback supersedes that
> interpretation; old evidence remains as rejection history."

Neo: `.workflows\fidel\starci-academy\dashboard-contribution-primary-tabs.md:234`, và ghi rõ đây là
hàng `WARNINGS` để không ai đếm nhầm nó vào sáu neo từ chối.

Kết quả trong repo sống là vòng B: `contribution-calendar-heading-row` tại
`contracts\index.ts:1244-1251` đặt tổng số ở một đầu và `choice-tabs` chọn năm ở đầu kia trong một
hàng `justify-between`. Bản luật này chốt ở đó và biến tiêu chí thành một câu hỏi kiểm được, *cái nút
này đổi cái gì*, thay cho một tính từ.

### Ghi chú về nguồn neo

Sáu neo từ chối được kiểm lại từng dòng trước khi ghi vào [`INDEX.md`](./INDEX.md). Ba dòng có số
dòng lệch so với bản thu thập ban đầu và đã được sửa về đúng vị trí thật: "Visible panel must change
without URL mutation." nằm ở `learn-branch.md:2111`, "Legacy mobile tabs switch contents, lesson and
outline views without changing route." nằm ở `learn-branch.md:757`, và "Nếu điều hướng ngay thì người
dùng không thể đọc detail panel." nằm ở
`global-search-modal-spacing-listbox-20260815-01.md:467`.
