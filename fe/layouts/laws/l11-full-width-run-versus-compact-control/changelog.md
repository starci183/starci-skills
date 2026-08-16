---
id: fe-layouts-laws-l11-full-width-run-versus-compact-control-changelog
title: changelog.md
slug: /fe/layouts/laws/l11-full-width-run-versus-compact-control/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật L11, kể cả hai vòng phán quyết ngược chiều mà cả hai đều còn hiệu lực.
---

# changelog.md

> Phiên bản hiện tại: `1.00` · Mô-đun: `l11-full-width-run-versus-compact-control`

## Quy tắc phiên bản

Một thay đổi luật được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Thêm một
mã tình huống là bump nhỏ. Đổi một trong hai vế của câu hỏi phân loại là bump lớn cho cả kệ, vì
[`l4`](../l4-tab-switches-panel-route-switches-page/INDEX.md) `L4-4` và
[`l10`](../l10-region-width-belongs-to-its-owner/INDEX.md) đều có một câu về hình dạng điều khiển rẽ
vào đây. Thêm một trường hình dạng điều khiển vào [`gate.schema.json`](../../gate.schema.json) là thay
đổi GATE và phải làm ở schema trước. Một phán quyết thứ ba của thầy trên cùng một điều khiển cũng là
thay đổi luật, vì nó kiểm xem thứ vừa dịch chuyển là tiêu chí hay chỉ là một trong hai câu trả lời.

## Nghiệm thu — 2026-08-17

Đợt kiểm sau khi lập mô-đun. Không đổi hai vế của câu `Law`, không thêm bớt mã tình huống, nên
**không bump phiên bản**.

- **Sửa một con số đếm sai trong mục `Inputs`.** Câu giải thích `landmark` viết "ba hàng đầy và sáu
  điều khiển gọn", trong khi bảng đo của [`audit.md`](./audit.md) có mười bốn call site: bốn hàng
  đầy và mười điều khiển gọn. Câu ấy nay đọc là ba hàng đầy ĐÚNG cùng đủ mười điều khiển gọn, và nói
  thêm rằng hàng đầy thứ tư cũng không mở landmark nào — đó chính là cách chỗ vi phạm tự lộ ra.
- **Sửa một ô tự mâu thuẫn trong bảng đo.** Hàng "Cách trả tiền trong overlay thanh toán" khai vế
  thứ nhất là `giá trị` mà lại phát `L11-4`, trong khi câu `Law` nói một giá trị luôn ra `L11-2`.
  Vế thứ nhất đúng là `mặt`: chọn trả góp làm hiện ra cả `schedule` lẫn `terms`, và chính `why` của
  `checkout-panel-column` tại `contracts\index.ts:2539` nói hai slot ấy optional CÙNG với lựa chọn
  bên trên chúng.
- **Ba chỗ trỏ sai đã được sửa thật, không chỉ ghi ra.** Hàng `L11` của bảng định tuyến kệ nay là một
  link với Kind **criterion — founder flipped** đúng như `L5`; `L10` trỏ tiêu chí hình dạng sang đây
  thay vì sang `L4`; và ngoại lệ của `L4` nay nói rõ `L4-4` ĐỌC tiêu chí từ đây chứ không tự chốt.
  Kệ tăng lên `1.01`.
- **Câu về `L7` trong `Scope` và một dòng trong [`example.md`](./example.md) không còn viết rằng
  chiều rộng overlay "còn nợ trên kệ".** `L7` đã có mô-đun và cả hai chỗ nay trỏ vào nó.
- **Kiểm lại toàn bộ neo.** Sáu dòng bác cùng ba dòng phân loại khớp nguyên văn với hồ sơ
  `dashboard-contribution-primary-tabs.md`, và mọi neo CODE mở được. Cả hai vòng phán quyết vẫn còn
  nguyên trong mục `Anchor`; mô-đun không chốt về bên nào.

## 1.00 — 2026-08-17

Mô-đun được lập lần đầu trên kệ `fe/layouts/laws/`, từ sáu dòng từ chối trong một hồ sơ và từ một lần
đo mười bốn call site điều khiển chọn kiểu tab trong repo sống `D:\Repositories\starci-academy-fe`
nhánh `main`.

- **Phát biểu luật thành một câu hỏi có thứ tự, không thành một chiều ngang.** Đây là hạng
  `criterion — founder flipped` và nó đứng cùng hạng với
  [`l5`](../l5-every-route-has-a-real-owner/INDEX.md). Thầy đã phán hai chiều ngược nhau trên đúng một
  điều khiển, nên canon chọn một bên làm mặc định là tự mâu thuẫn với kho phán quyết của chính nó.
- **Tách câu hỏi thành hai vế đi theo thứ tự.** Vế thứ nhất hỏi cái nằm dưới đổi giá trị hay đổi mặt.
  Vế thứ hai chỉ mở khi câu trả lời là mặt, và nó hỏi mặt ấy thuộc vùng của trang hay một vùng bên
  trong trang. Bỏ vế nào cũng sai ở một chỗ đo được: bỏ vế đầu thì `scope-switch-row` bị kéo dài dù nó
  vừa được sửa khỏi đúng hình dạng ấy, bỏ vế sau thì ba mặt nội dung của trang học mọc một hàng gạch
  chân giữa một cột đọc đã bị kẹp giữa hai cột khác.
  Neo: `contracts\index.ts:1504-1511` và `pages\CourseLearnContentPage\component.tsx:495-522,534-542`.
- **Đặt sáu mã tình huống.** `L11-1` đến `L11-6`, trong đó `L11-6` phát ra **không gì cả** và vẫn là
  một tình huống được phân loại, vì hai cách đọc cùng bảo vệ được là câu hỏi cho thầy chứ không phải
  khoảng trống cho người viết plan tự điền.
- **Tách `L11-4` ra khỏi `L11-1`.** Nếu không có mã riêng thì ba mặt nội dung của trang học, cặp mua
  hoặc dùng thử trong rail và cặp cách trả tiền trong overlay đều bị đọc thành trường hợp hợp lệ của
  `L11-1`, trong khi cả ba đang gọn trong repo sống.
- **Đặt `L11-3` để chuỗi `w-full` thôi làm bằng chứng.** Ba hợp đồng `L11-1` và hai hợp đồng `L11-3`
  đều mang `w-full`, nên đọc mảng `classes` mà không hỏi lại từng điều khiển sẽ ra kết quả ngược ở hai
  chỗ. Neo: `contracts\index.ts:1323-1329` và `contracts\index.ts:1243-1244`.
- **Nhận cả nửa tên gọi của cú lật vào `L11-5`.** Hai dòng bác `:172` và `:241` nói về việc token của
  vendor không phải bằng chứng phân loại, và bỏ chúng đi thì mô-đun chỉ giữ được bốn trong sáu dòng
  bác của hồ sơ.
- **Nói rõ lớp sơn gạch chân không làm nên một hàng đầy.** Trục ngôn ngữ của trang học giữ lớp sơn ấy
  mà vẫn intrinsic, với lý do ghi ngay cạnh giá trị, nên một hàng chạy hết chiều ngang phải có đủ ba
  dấu hiệu là cả dòng, lớp sơn và một landmark.
  Neo: `blocks\learn\ContentTabRow\component.tsx:108-110`.
- **Ghi bốn khoản đo được vào [`audit.md`](./audit.md)** thay vì để luật nói như thể đã xong: gate
  không có trường nào cho luật này, bảng định tuyến của kệ vẫn ghi `L11` là owed, `L4` cùng `L10`
  đang trỏ tiêu chí đi chỗ khác, và cây sống tự mâu thuẫn ở cặp trang học với trang bài luyện mã.

### Vòng phán quyết đã bị lật

Cả bốn dòng bác về hình dạng nằm trong cùng một hồ sơ,
`.workflows\fidel\starci-academy\dashboard-contribution-primary-tabs.md`, và cả hai vòng đều còn hiệu
lực theo đúng nghĩa của chúng.

| Vòng | Bác | Chọn | `Why` nguyên văn | Neo |
|---|---|---|---|---|
| A | Intrinsic secondary year control at the row end | Full-width primary underline run | "User: “nó phải là 1 line dài như shellnav”." | `:82` |
| A | Keep year selector intrinsic at the summary row edge | Full-width primary line | "User requires “1 line dài như shellnav”." | `:173` |
| B | Treat year parameter as ShellNav-level navigation | Compact control beside the plot summary | "It changes one visualization parameter, not the page's content region." | `:242` |
| B | Full-width underline years | Intrinsic segmented years | "The former is secondary region navigation, not a local calendar parameter." | `:291` |

Vòng A nói rằng cái điều khiển ấy là chính chứ không phải phụ, và lúc đó chữ chính bị hiểu thành một
dải rộng như ShellNav vì đó là thứ chính duy nhất đang có trên màn hình để mà so. Hai con số đo ở
`:50-51` cho thấy phép so ấy là phép so trực tiếp: tablist chọn năm rộng `189.625px` bắt đầu ở x
`978.775px`, còn tablist của ShellNav rộng `1216.8px` bắt đầu ở x `24px`.

Vòng B giữ nguyên việc nó là chính và chỉ sửa nghĩa của chữ ấy. Bản ghi tự xếp phản hồi vòng hai vào
loại `correction-of-prior-interpretation` ở `:207`, và giữ vòng một lại làm lịch sử ở một hàng
`WARNINGS`:

> "Earlier session evidence called a full-width underline “primary”. This feedback supersedes that
> interpretation; old evidence remains as rejection history."

Bảng `OUTPUTS` của vòng hai ở `:213-215` viết ra tiêu chí đã được thầy duyệt, rằng primary là một lựa
chọn segmented gọn bên trong một ngữ cảnh có ranh giới còn secondary là điều hướng gạch chân giữa
những vùng nội dung lớn. Câu ấy sau đó được chép thẳng vào leaf tại
`leaves\ChoiceTabs\index.tsx:26-31`, và kết quả vòng hai đóng băng trong hợp đồng
`contribution-calendar-heading-row` tại `contracts\index.ts:1243-1250`.

Bản luật này chốt ở vòng B về mặt kết quả, nhưng thứ nó giữ lại không phải kết quả ấy. Cái được giữ là
câu hỏi đã phân biệt được hai vòng, vì một canon chỉ chép lại kết quả sẽ trả lời sai ngay ở điều khiển
tiếp theo mà nó chưa từng gặp.

### Ghi chú về nguồn neo

Sáu neo từ chối được kiểm lại từng dòng trong hồ sơ trước khi ghi vào [`INDEX.md`](./INDEX.md), và cả
sáu đều đúng vị trí đã nhận. Bốn dòng ngoài lề được kiểm thêm và **không** dòng nào được xếp vào cột
neo từ chối, vì chúng không phải hàng `REJECTED` có cột `Why`: `:207` là dòng phân loại phản hồi,
`:213-215` là bảng `OUTPUTS`, `:235` là một hàng `WARNINGS`, và `:50-51` là hai dòng đo.

Một dòng `REJECTED` thật của hồ sơ bị bỏ ra ngoài có chủ ý. `:83` bác việc đổi hành vi chọn năm, với
lý do rằng phản hồi chỉ nói về thứ bậc và cách vẽ, nên nó không thuộc luật này.

Một neo lệch dòng trong mô-đun khác được ghi lại chứ không sửa. `l4-...\changelog.md` dẫn câu
`WARNINGS` về dòng `:234`; dòng `234` là dòng phân cách bảng và câu ấy nằm ở `:235`. Mô-đun này dùng
`:235`.

### Hai call site tìm thêm được khi đo lại

Bằng chứng nhận ban đầu liệt kê chín điều khiển. Lần đếm lại bằng `grep` trên `<ChoiceTabs` và
`<ExtendedTabs` trong `src/components`, bỏ file test, trả về mười bốn call site và làm lộ hai chỗ mà
tài liệu suýt bỏ sót.

- **`composites\DualTabsToolbar\index.tsx:21-30`**, một chủ thứ hai của hợp đồng `dual-tabs-toolbar`,
  ép cả hai trục về `primary` và được `blocks\dashboard\FeedExplorer\component.tsx:35-40` dùng cho cặp
  phạm vi với hạng mục của luồng hoạt động. Cả hai đều là giá trị của cùng một luồng nên cả hai gọn.
- **`blocks\coding\ProblemReadingColumn\component.tsx:88-103`**, một hàng `ExtendedTabs` chạy hết
  chiều ngang bên trong `problem-reading-column`, tức là bên trong một cột rộng `md:w-2/5` của
  `coding-problem-page`. Theo tiêu chí thì đây là `L11-4` và điều khiển phải gọn, nên nó là vi phạm
  còn sống của mô-đun. Nó cũng là cặp so sánh mạnh nhất mà mô-đun có, vì trang học đặt cùng câu hỏi và
  trả lời ngược lại, và không bên nào có một lời phán của thầy đứng sau.
