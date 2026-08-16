---
id: fe-layouts-laws-l3-section-tabs-are-navbar-second-row-audit
title: audit.md
slug: /fe/layouts/laws/l3-section-tabs-are-navbar-second-row/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện luật L3: chỗ nó phân định được, chỗ repo sống lệch khỏi nó, và một phán quyết cũ trên kệ đang dựa vào vòng đã bị lật.
---

# audit.md

> Phiên bản: `1.00` · Mô-đun: `l3-section-tabs-are-navbar-second-row`

Phản biện này kiểm xem luật có chọn được đúng một mã từ **quan hệ đã nêu**, và chỉ từ đó.

## Kết luận

Chấp nhận, với một chênh lệch đã đo mà chưa có phán quyết, một khoản nợ cấu trúc, và một phán quyết
cũ trên kệ cần sửa vì nó trích vòng đã bị lật.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `L3-1` so với `L3-2` | Loại trừ được khi đã nêu ai gọi tên được tập mục: layout của cụm, hay chỉ trang |
| `L3-1`·`L3-2` so với `L3-3` | Loại trừ được khi đã nêu trang có sở hữu một tập mục đóng của cùng một tài liệu hay không |
| `L3-3` so với `L4` | Loại trừ được bằng câu hỏi mục có breadcrumb và metadata riêng hay không; có thì đó là route, không phải mục |
| `L3-2` so với `L3-4` | Loại trừ được bằng bốn tiêu chí kiểm trên render, không bằng vị trí trong cây file |
| `L3-4` so với breadcrumb | Loại trừ được bằng vai trò: đi trong tài liệu là tabs, nói tài liệu nằm đâu là breadcrumb |
| `L3-5` khi thiếu tên token | Rơi về "hỏi lại", không rơi về "bỏ hàng trên" |
| `L3-6` khi có proof cũ | Proof cũ không đóng được `L3-6`; nó chỉ đóng đúng câu hỏi nó đã đo |
| `L3-7` so với mọi mã | Loại trừ được bằng vùng đổi hay hình vẽ lại, rồi giao hẳn cho `L4` |
| Thiếu bằng chứng về ai thấy tập mục | Không rơi về mặc định nào; `visibility` là input bắt buộc |

Chỗ luật này chạm sang kệ khác và tự dừng lại: giá trị offset của thứ ghim dưới cụm hai hàng thuộc
`L9`, chiều rộng của body bên dưới thuộc `L10`, và chuyện một điều khiển có phải tab hay không thuộc
`L4`. Cả ba đều được gọi tên trong `INDEX.md` và không cái nào được định giá trị ở đây.

## Repo sống đang ở đâu

**Đang tuân ở hai cụm, lệch ở một, và không áp dụng ở phần còn lại.**

`L3-1` sống ở dashboard: `ShellNav` tự tính tập tab từ pathname rồi điền slot `bottom`, nên hai hàng
nằm trong đúng một container `sticky top-0 border-b` và không có class khoảng cách nào ở giữa.

`L3-2` sống ở chi tiết khoá học: `course-section-navigation` khai `host: "nav"`, ghim `sticky top-16`,
dán bằng `-mt-px`, và đóng bằng một `border-b`. Bốn tiêu chí đạt bằng cấu trúc.

`L3-3` sống ở năm cụm còn lại, qua `optional: true` trên slot thứ hai.

Chỗ lệch là cụm `profile`. `profile-tabs-over-body` chỉ mang `flex w-full flex-col`, tức là hàng tabs
không ghim, không dán, không có nét kẻ riêng, và nó nằm bên trong `routed-page-main` dưới một
`double-navbar` có ghim. Người đọc cuộn xuống thì navbar ở lại còn hàng tabs đi mất, hỏng tiêu chí
thứ hai của luật.

Nhưng không dòng từ chối nào nói về profile, và `why` của contract lập luận ngược lại có chủ ý khi
viết rằng chrome của route profile thuộc về layout profile chứ không phải tầng hai của navbar toàn
cục. Nên đây là **chênh lệch đã đo, chưa có phán quyết**. Ghi thành vi phạm là mượn thẩm quyền chưa
được trao.

## Nợ đã đo được

- **Nợ phán quyết, cụm `profile`.** Hàng tabs của profile không ghim và không dán. Luật nói nó phải,
  contract nói nó không, và thầy chưa xử. Câu phải hỏi: hàng tabs của profile có phải tầng hai của
  navbar như dashboard và course detail, hay profile là một archetype khác mà chrome của nó thuộc về
  trang. Cho tới khi có câu trả lời, một kế hoạch mới không được viện profile ra làm tiền lệ.
  Neo: `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:781-788` và
  `D:\Repositories\starci-academy-fe\src\app\[lang]\profile\layout.tsx:11`.
- **Nợ cấu trúc, chi tiết khoá học.** Luật đúng về mặt nhìn ở cả hai trang nhưng đúng về mặt cấu trúc
  chỉ ở một. Dashboard có một landmark điều hướng, chi tiết khoá học có hai chồng lên nhau vì
  `course-section-navigation` khai `host: "nav"` bên dưới `double-navbar`. Chính `why` của nó tự nhận
  điều đó khi phải viện đến chuyện chồng lên đúng một pixel để biện minh cho việc kết quả giống
  Dashboard. Đây là cái giá đã chấp nhận của `L3-2`, không phải chuyện đã xong.
  Neo: `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:2226-2231`.
- **Nợ sửa trên kệ.** [`sticky-chrome-band/INDEX.md`](../../archetypes/sticky-chrome-band/INDEX.md) đặt `CHROME-8`
  trên vòng một của phán quyết và liệt hàng route trên primary row là live breach; shelf `INDEX.md`
  chép lại vào bảng `Live breaches`. Vòng hai đã lật đúng điều đó và repo sống mang bản vòng hai: hàng
  chính giữ đủ route, hàng tabs bỏ icon. Nghĩa là mục breach đó không còn là breach, và `CHROME-8`
  phải viết lại ở dạng lặp token. Sửa hai file kia là thay đổi của kệ, không phải của mô-đun này, nên
  ghi nợ chứ không tự sửa.
  Neo: `.workflows\fidel\starci-academy\courses-runtime-projection-i18n-20260815-01.md:598`;
  `D:\Repositories\starci-academy-fe\src\components\layouts\ShellNav\index.tsx:113-121`;
  `D:\Repositories\starci-academy-fe\src\components\pages\CourseDetailPage\component.tsx:465-470`.
- **Nợ đo seam.** `L3-6` yêu cầu hai giá trị border thật, và mô-đun này chưa có chúng. Con số 2.1rem
  cho chiều cao hàng tabs được ghi là "measured on the live route" trong bình luận CSS, nhưng phép đo
  đó không kèm route, viewport, theme hay persona nào, nên nó không đóng được `L3-6` cho lần này.
  Neo: `D:\Repositories\starci-academy-fe\src\app\globals.css:58-64`.

## Nhận định

- Luật bị bác bảy lần và không lần nào vì cấu trúc khó hiểu. Bốn lần đầu là cùng một hiểu lầm rằng
  "dính vào navbar" là chuyện vị trí lúc nghỉ, trong khi ba trong bốn lần đó bị bắt lúc cuộn hoặc lúc
  nhìn kỹ chỗ giáp. Vì thế bản `1.00` phát biểu bằng bốn tiêu chí kiểm trên một lần render chứ không
  bằng một danh sách class.
- `L3-3` phát ra "không có hàng thứ hai" và đó là một tình huống, không phải một chỗ trống. Đây là mã
  dễ đọc nhầm nhất, nên nó được nói rõ ở cả ba tài liệu.
- `L3-5` là chỗ duy nhất thầy tự lật trên luật này, và cái lật không đổi nguyên tắc mà đổi đối tượng:
  vẫn là "không nói hai lần", nhưng thứ nói hai lần là bộ icon chứ không phải hàng điểm đến. Rủi ro
  còn lại là người đọc sau này lại suy từ "không lặp" ra "bỏ một hàng", nên luật buộc gọi tên token
  trước khi đề xuất gỡ.
- Hai số dòng trong bằng chứng đầu vào không khớp file: các câu của thầy về bỏ nội dung và bỏ icon
  được ghi ở `:1367` và `:1444`, nhưng file chỉ dài 605 dòng và hai hàng `REJECTED` thật nằm ở `:521`
  và `:598`. Mô-đun này neo vào hai dòng đã đọc lại. Đây là lý do một neo phải được mở ra kiểm chứ
  không chép lại.
- Điểm yếu còn lại: "ai gọi tên được tập mục" là ranh giới sạch hôm nay vì chỉ có hai ví dụ sống. Một
  trang mà layout của cụm *có thể* biết tập mục nhưng phải chờ một request mới biết sẽ không rơi gọn
  vào `L3-1` hay `L3-2`, và chưa có màn hình nào đã ship để phân xử. Đo một cái thứ ba trước khi đặt
  thêm mã.
- Chưa đo bằng ảnh chụp. Mọi câu về seam, về một pixel chồng lên và về hàng tabs cuộn mất ở profile
  trong tài liệu này suy từ contract, CSS và phán quyết cũ, không từ một lần render dưới cùng route,
  viewport, theme và persona.
