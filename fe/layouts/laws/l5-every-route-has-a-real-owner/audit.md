---
id: fe-layouts-laws-l5-every-route-has-a-real-owner-audit
title: audit.md
slug: /fe/layouts/laws/l5-every-route-has-a-real-owner/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện luật L5: chỗ nó phân định được, chỗ repo sống đang tuân, khoản nợ cú lật để lại, và chỗ nó lệch với SPINE-6 của kệ.
---

# audit.md

> Phiên bản: `1.00` · Mô-đun: `l5-every-route-has-a-real-owner`

Phản biện này kiểm xem luật có chọn được đúng một mã từ **quan hệ đã nêu**, và chỉ từ đó, mà không
lén chọn hộ đích của cửa vào.

## Kết luận

Chấp nhận, với một khoản nợ sản phẩm đã đo được, một chỗ lệch với kệ phải hoà giải, và một nghĩa vụ
mà không gate nào giữ.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `L5-1` so với `L5-2` | Loại trừ được bằng đúng một câu: bỏ route này thì có nội dung nào không còn ở đâu nữa không |
| `L5-2` so với `L5-3` | Loại trừ được bằng nguồn của đích, params hay runtime, không bằng route quan trọng đến đâu |
| `L5-1` so với `L5-4` | Loại trừ được khi gọi được tên thư mục owner; không gọi được tên thì luôn là `L5-4` |
| `L5-4` so với `L5-2` | Loại trừ được bằng cùng câu hỏi của `L5-1`; hai mã này nhìn giống hệt nhau trong diff |
| `L5-5` so với mọi mã | Chỉ mở khi cả hai đích đều bảo vệ được bằng lý do sản phẩm, không mở khi người viết chỉ đang lưỡng lự |
| `L5-6` so với dọn dẹp thường | Loại trừ được bằng nguyên nhân: có phán quyết vừa dời nội dung khỏi route hay không |
| Thiếu bằng chứng về nội dung | Rơi về `L5-4`, không rơi về "cứ redirect cho xanh" |
| Có lấn sang kệ khác không | Không. Luật dừng ở thân file route và tên owner; regions, states và archetype thuộc module khác |

Chỗ đáng ngờ nhất đã kiểm riêng: `L5-3` có phải là một cửa hậu cho phép mọi cửa vào mọc owner
không. Không, vì điều kiện mở nó là `destinationEvidence: from-runtime-answer`, và trong repo sống
chỉ đúng một route thoả. Ba cửa vào còn lại đều tính đích từ params và đều không có owner.

## Repo sống đang ở đâu

**Đang tuân, và đo được sạch.** Quét toàn bộ `src/app`: 51 file `page.tsx`, 48 file mount một owner
từ `@/components/pages/`, 3 file gọi `redirect()`, 0 file làm việc khác. Không có thân file thứ ba.

Ba cửa vào là `[lang]\page.tsx`, `learn\page.tsx`, `learn\flashcards\page.tsx`, và cả ba đều tính
đích từ tham số đường dẫn, tức `L5-2`. Cửa vào duy nhất phải hỏi runtime là `/profile`, và nó có
owner thật, tức `L5-3`. Không route nào đang ở `L5-4`.

Một dữ kiện đáng ghi: `/qa` từng nằm ở `L5-4` dưới dạng redirect giữ cho parity, đã bị lật, và hôm
nay `qa\page.tsx:7` mount `CourseQaPage`. Luật này không chỉ mô tả trạng thái hiện tại, nó đã từng
đổi được một route.

## Nợ đã đo được

- **Nợ sản phẩm, do cú lật `L5-5` để lại.** `src/components/pages/CourseLearnTodayPage/` còn nguyên
  ba file `index.tsx`, `component.tsx`, `component.test.tsx`, gọi tám hook SWR, và không route nào
  mount nó. Grep `CourseLearnTodayPage` trên toàn `src/` trừ chính thư mục đó trả về rỗng. Kéo theo
  ba thứ nữa: `isToday` tại `LearnShellLayout\index.tsx:128`, `TODAY_TABS` tại `:95-99`, và khoá
  contract `course-learn-today-page` tại `contracts\index.ts:293`.
  Neo: `D:\Repositories\starci-academy-fe\src\components\pages\CourseLearnTodayPage\index.tsx:20`.
- **Nợ gate.** Không rule nào hỏi được "route nào mount trang này". Cả bốn thứ trên vẫn biên dịch,
  và `component.test.tsx` vẫn xanh vì nó render nửa thuần trực tiếp chứ không đi qua route. Nghĩa là
  `L5-6` hôm nay được giữ bằng kỷ luật đọc kế hoạch, không bằng máy.
  Neo: `D:\Repositories\starci-academy-fe\src\components\pages\CourseLearnTodayPage\component.test.tsx:3`.
- **Nợ định tuyến trong kệ.** Bảng `Routing the eleven layout laws` ở
  [`../../INDEX.md`](../../INDEX.md) trỏ `L5` vào `destination-column` (`SPINE-6`) và chưa biết đến
  thư mục `laws/` này. Cho tới khi bảng đó thêm một dòng, một người đọc đi từ gốc kệ sẽ không tìm
  thấy module này.

## Nhận định

- **Chỗ lệch thật với `SPINE-6`, và nó không nhỏ.** `destination-column/INDEX.md:61-64` đặt tên
  "Ruling A" cho lần bác stub tại `learn-branch.md:495`, rồi "Ruling B" cho cú lật tại
  `learn-legacy-ai-policy.md:79`. Đọc như thế thì hai phán quyết ấy không hề ngược chiều nhau, chúng
  là hai luật khác nhau đặt cạnh nhau. Cặp thật sự ngược chiều là `learn-branch.md:1858` cùng
  `:2109` đối với `learn-legacy-ai-policy.md:79` cùng `:159`, và hai neo đầu **không có mặt** trong
  bảng anchor của `destination-column`. Module này tách ra: lần bác stub là `L5-4`, cú lật về cửa
  vào là `L5-5`. Đây là một finding phải hoà giải chứ không phải hai cách nói cùng một ý.
- **Bù lại, kết luận về repo thì hai bên khớp.** `SPINE-6` viết "three redirects, all three doors",
  và phép đếm 51/48/3/0 ở trên xác nhận đúng ba file đó.
- **`L5-5` phát ra một câu hỏi, và đó là điểm yếu có chủ ý.** Một mã không trả về giá trị thì không
  máy nào kiểm được nó đã được trả lời tử tế hay chưa. Đổi lại, mọi phương án khác đều đòi canon
  chọn một bên trong hai lần thầy phán ngược nhau, và cái giá đó cao hơn.
- **Phép thử `contentElsewhere` mạnh hơn vẻ ngoài của nó.** Nó buộc người viết gọi tên một route
  thay, chứ không buộc đánh giá route quan trọng đến đâu. Gọi được tên thì cửa vào hợp lệ, không gọi
  được thì route mang nội dung. Không có khoảng giữa để lách.
- **Điểm yếu còn lại nằm ở `L5-4`.** "Owner có tên" vẫn là một phán đoán của người. Gate bắt được
  phần hình thức, tức có dòng `owed` hay không, nhưng chưa có cách nào chặn một cái tên đặt cho đủ
  thủ tục rồi ba tuần sau vẫn rỗng.

## Rủi ro còn mở

- **`isToday` có thật sự không bao giờ true hay không thì chưa đo.** Suy luận là `redirect()` phía
  server bắn trước khi cây layout commit, nên pathname `${base}/learn` không tồn tại đủ lâu. Chưa
  chạy lần nào dưới route thật để xác nhận, cũng chưa kiểm nhánh soft navigation phía client. *Suy
  luận, không có neo.*
- **Chưa đo bằng ảnh chụp.** Mọi câu trong tài liệu này về việc người đọc thấy gì trong lúc
  `/profile` chờ truy vấn đều suy từ mã, không từ một lần render dưới cùng route, viewport, locale,
  theme, persona và seed. `_ProfileRedirectPage` trả `null` có nghĩa là màn hình trắng trong khoảng
  chờ đó, và không có bằng chứng nào cho thấy khoảng ấy đủ ngắn để không ai kịp thấy.
- **Ranh giới `L5-1` với `L5-3` chưa bị thử ở ca khó.** Một route vừa mang nội dung vừa chuyển hướng
  trong vài điều kiện chưa tồn tại trong repo, nên luật đang từ chối hình dạng đó bằng cách đẩy về
  `L5-5`. Nếu sản phẩm sinh ra ca ấy thật, mã thứ bảy sẽ cần một phán quyết chứ không suy ra được.
- **Bốn mươi tám owner chưa được kiểm từng cái.** Phép đếm chứng minh mỗi route mount một owner, nó
  không chứng minh owner đó có nội dung thật. Một owner rỗng nằm dưới `src/components/pages/` vẫn
  qua được phép đếm này, và đó đúng là hình dạng mà `L5-4` muốn chặn.

## Điều kiện phản biện lại

Audit này cũ đi khi một trong các việc sau xảy ra.

- Có redirect thứ tư xuất hiện trong `src/app`, hoặc số file `page.tsx` lệch khỏi 51.
- Thầy phán vòng ba về cửa vào `/learn`, hoặc phán về cửa vào của bất kỳ route nào khác.
- `CourseLearnTodayPage` bị dọn, hoặc được mount lại bởi một route.
- Bảng định tuyến ở [`../../INDEX.md`](../../INDEX.md) thêm dòng cho `laws/`, hoặc `SPINE-6` sửa lại
  cặp neo ruling A.
- Có rule lint biết hỏi route nào mount một trang, lúc đó nợ gate ở trên đóng lại và `L5-6` chuyển
  từ kỷ luật sang máy.
