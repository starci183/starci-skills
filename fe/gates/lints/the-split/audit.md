---
id: fe-lints-the-split-audit
title: audit.md
slug: /gates/lints/the-split/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức thực thi thật của hai luật, và kê đủ những cửa còn mở.
---

# audit.md

> Phiên bản: `2.00` · Mô-đun: `the-split`

Phản biện này kiểm một câu duy nhất: **cái gì trong văn bản luật thật sự được máy giữ, và giữ chặt tới
đâu.** Nguồn sự thật là tệp luật, không phải tên luật và không phải văn bản luật.

## Kết luận

Chấp nhận, với một điều kiện đọc kèm: mô-đun này **không được đọc như bằng chứng rằng `the split` đã
được thực thi**. Hai trong sáu điều luật có máy giữ, và hai luật đó dùng chung một bộ dò duy nhất mà
một hàm bọc tên bình thường là hạ được cả hai. Ghi lại đúng mức đó là mục đích của tài liệu này.

Số luật đếm được trong tệp nguồn: **đúng 2**, khớp với con số dự kiến. Hai luật xuất ra ở
`export const rules`, mang tên `presentational-purity` và `connected-block-has-presentational-twin`,
và cả hai được `export const recommended` đặt ở mức `error`.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| Mỗi luật có ánh xạ được vào một mã của văn bản luật không | Có. Tệp nguồn tự đánh dấu bằng hai dải phân cách `-- SPLIT-1 --` và `-- SPLIT-5 --`, và hành vi khớp với chữ của hai mã đó |
| Có luật nào giữ một thứ văn bản luật không nói không | Không |
| Mã luật nào không có luật máy | `SPLIT-2`, `SPLIT-3`, `SPLIT-4`, `SPLIT-6` — bốn trên sáu |
| Danh tính luật có bị đặt trùng không | Không. Danh tính là **tên đã công bố**; tài liệu này không đặt thêm mã số nào |
| Phạm vi có được quyết bằng thứ ổn định không | Không. Cả hai đều quyết bằng **đường dẫn tệp**, thứ rẻ nhất trong kho mã để đổi |
| Bộ dò thế giới có độc lập giữa hai luật không | Không. Cùng một hằng số biểu thức chính quy phục vụ cả hai; hỏng một chỗ là hỏng cả hai |
| Luật có kiểm được nửa còn lại không | Không. Mỗi luật đọc đúng một tệp và không bao giờ mở tệp kia |
| Có tuỳ chọn hay danh sách miễn không | Không. Cả hai khai báo `schema: []` |

## Phát hiện

1. **Cả hai luật đứng trên cùng một hằng số `REACHES_FOR_THE_WORLD`.** Đây là điểm hỏng chung duy
   nhất của mô-đun: một hàm bọc tên bình thường vừa làm luật thứ nhất câm, vừa làm luật thứ hai tắt
   hẳn (vì `readsWorld` không bật thì `Program:exit` trả về ngay). Đọc riêng từng luật thì thấy hai
   lớp phòng vệ; đọc chung thì chỉ có một.
2. **Tên `connected-block-has-presentational-twin` hứa nhiều hơn hành vi.** Chữ *has* gợi ý luật đã
   xác minh bản sao tồn tại và là bản sao thuần. Thực tế luật chỉ kiểm: có một phép nhập khít ba phần
   từ chuỗi `./component`, và có một thẻ JSX trùng tên. Nó **không mở `component.tsx`** lần nào. Bản
   sao rỗng, bản sao tự gọi mạng, hay bản sao được xuất từ nơi khác đều lọt.
3. **Tên `presentational-purity` cũng hứa nhiều hơn hành vi.** "Purity" ở đây không phải thuần khiết
   theo nghĩa hàm: luật không nhìn props bị đột biến, không nhìn `useEffect`, không nhìn `fetch`,
   không nhìn khoá dịch đi qua ranh giới. Nó là bốn họ tên hàm.
4. **Luật thứ nhất không đọc `import`, luật thứ hai có.** Hệ quả là cùng một động tác đổi tên lúc nhập
   bị bắt ở nửa đã nối và lọt ở nửa vẽ. Đây là chênh lệch trong chính mô-đun, không phải chênh lệch
   giữa mô-đun và văn bản luật.
5. **`bypass` bắt cả thẻ HTML thường.** Một `<div>` bọc ngoài cũng bị báo, vì mọi `JSXIdentifier` đều
   vào danh sách. Đúng chữ của `SPLIT-5` — nửa đã nối không vẽ gì của riêng nó — nhưng khắt khe hơn
   mức người ta chờ đợi, và là chỗ dễ sinh áp lực xin ngoại lệ nhất.
6. **Thẻ có dấu chấm thoát khỏi chính `bypass` đó.** `JSXMemberExpression` bị bỏ qua trước khi đẩy vào
   danh sách. Nghịch lý: bọc `<div>` thì bị bắt, bọc `<Ui.Card>` thì không.
7. **Đổi tên khi nhập sinh báo nhầm.** `import { _X as View }` và `import * as View` đều làm
   `importsTwin` sai và sinh `missing` cho một tệp viết đúng tinh thần. Đây là ma sát chứ không phải
   lỗ hổng, nhưng nếu không biết trước thì kết luận thường là "luật hỏng, gỡ đi".
8. **Họ `query<ChữHoa>…` bắt cả hàm thuần tuý.** Một hàm dựng chuỗi truy vấn hoặc một biến `queryClient`
   được gọi như hàm đều khớp. Báo nhầm ở đây rẻ (đổi tên là xong) nhưng có thật.
9. **`use…Swr` đòi đúng hậu tố `Swr`.** `useOrderSWR` nằm ngoài. Một kho mã đặt tên viết hoa hết thì
   toàn bộ họ thứ nhất không bắt được gì.
10. **Phạm vi của luật thứ hai gắn với đúng một chuỗi đường dẫn** `/src/components/blocks/`, một tên
    thư mục viết hoa, và cửa vào `index.tsx`. Bề mặt đặt ở nơi khác, hay vào bằng `index.ts`, là
    không có luật — chứ không phải là đạt.

## Quyết định

- Ghi **tên luật** làm tiêu đề mục, đúng từng ký tự như build in ra. Không đặt mã số cho luật: một
  luật hai tên là một luật không truy được nguồn thông điệp.
- Không viết "none" ở bảng cửa mở của bất kỳ luật nào. Mỗi luật đều có hàng thật, đọc ra từ mã nguồn.
- Không tài liệu hoá luật nào không có trong tệp nguồn. Bốn mã còn lại của văn bản luật được kê ở đây
  như **rủi ro**, không như luật.
- Giữ nguyên kết luận rằng `bypass` bắt thẻ thường là **đúng ý luật**, và ghi thẳng nghịch lý thẻ có
  dấu chấm thay vì làm mềm một trong hai.
- Coi nhóm phát hiện 2 và 3 (tên hứa nhiều hơn hành vi) là **phát hiện phải công bố**, không phải lỗi
  phải sửa trong tài liệu: đổi tên luật là đổi chuỗi ký tự đã in ra ở mọi build log và mọi dòng comment
  tắt luật, nên đó là một thay đổi luật có phiên bản riêng.

## Rủi ro còn mở

Mỗi mục nêu **luật sẽ phải nhìn thêm cái gì** để đóng, hoặc vì sao đóng đắt hơn để mở.

- **Hàm bọc tên bình thường (rủi ro lớn nhất).** Để đóng, luật phải lần theo tên: đọc `import`, mở tệp
  được nhập, và kết luận rằng hàm đó cuối cùng có chạm thế giới hay không — tức là phân tích liên tệp
  với đồ thị gọi. Cái giá là mất tính cục bộ của luật và mất khả năng chạy trên một tệp đơn lẻ. Nhận
  định: **chấp nhận để mở**, nhưng phải nói thẳng, vì đây là cửa mà một lần dọn dẹp thiện chí cũng mở
  ra được.
- **Gọi qua thuộc tính (`hooks.useTranslations()`).** Để đóng, chỉ cần thêm nhánh `MemberExpression`
  cho callee và thử `property.name` với cùng họ. Rẻ, và nên là đề xuất đầu tiên. Rủi ro kèm theo: sẽ
  bắt cả `input.props.t(...)` nếu không loại trừ cẩn thận.
- **Đổi tên lúc nhập ở nửa vẽ.** Để đóng, luật thứ nhất phải làm đúng việc luật thứ hai đã làm: thu
  tập tên cục bộ từ `ImportDeclaration`. Rẻ, cùng một đoạn mã đã có sẵn trong cùng tệp.
- **Hậu tố viết hoa hết (`SWR`).** Để đóng, nới họ thành không phân biệt hoa thường ở hậu tố. Rẻ,
  nhưng làm rộng vùng báo nhầm.
- **Nửa vẽ với tay qua một đứa con đã nối.** Để đóng, luật phải nhìn `import` và biết được đường dẫn
  nào là một block đã nối — tức là suy luận theo quy ước thư mục. Làm được, nhưng biến một luật cú
  pháp thành một luật kiến trúc, và sẽ chặn cả những lần lồng ghép hợp lệ.
- **Vẽ bằng `createElement`.** Để đóng, thêm `createElement` vào tập lời gọi được coi là "vẽ" và so
  đối số thứ nhất với tên bản sao. Rẻ và nên làm.
- **Thẻ có dấu chấm (`<Ui.Card>`).** Để đóng, dựng lại tên đầy đủ từ `JSXMemberExpression` rồi đẩy vào
  danh sách như mọi thẻ khác. Rẻ, và đóng đúng một nghịch lý đang tồn tại.
- **Bản sao chưa bao giờ được mở ra xem.** Để đóng, luật phải đọc `component.tsx` cạnh nó và xác minh
  có một export tên `_X`. Đây là bước ra khỏi mô hình một-tệp-một-luật; chi phí không nằm ở việc đọc
  đĩa mà ở việc luật bắt đầu có trạng thái phụ thuộc thứ tự tệp.
- **Phạm vi theo tên tệp và theo đường dẫn (cả hai luật).** Không đóng được bằng cách nhìn kỹ hơn: đó
  là bản chất của quy ước làm phạm vi. Cách duy nhất là đổi hướng — quét theo cấu trúc thư mục thay vì
  theo tên tệp — và điều đó biến quy ước thành cấu hình, tức là mất chính cái lý do tệp nguồn nói rằng
  luật "không cần cấu hình". Nhận định: **để mở, nhưng phải ghi**.
- **`SPLIT-2` — hình thức bị quyết ở nửa đã nối.** Một phần đã bị `bypass` chặn gián tiếp (thẻ thường
  bọc ngoài là bị bắt), nhưng `className` truyền xuống qua props thì không ai nhìn. Đóng được một phần
  bằng cách cấm prop dáng vẻ đi qua ranh giới; cần một luật riêng, không thuộc mô-đun này.
- **`SPLIT-3` — cờ boolean thay cho một tên tình huống.** Đóng được bằng một luật đọc kiểu của props và
  từ chối nhiều `boolean` cùng lúc trong một shape đi qua ranh giới. Cần thông tin kiểu, tức là cần
  dịch vụ kiểu — đắt hơn hẳn hai luật hiện có.
- **`SPLIT-4` — khoá dịch đi qua ranh giới.** Đóng được bằng một luật cấm tên prop dạng `…Key` mang giá
  trị chuỗi từ nửa đã nối sang, nhưng quy ước đặt tên là chỗ dựa yếu; một khoá đặt tên `label` thì
  không phân biệt được với một chuỗi đã dịch nếu chỉ nhìn cú pháp.
- **`SPLIT-6` — tách đôi một bề mặt không gọi mạng.** Đóng được và rẻ: một tệp `component.tsx` tồn tại
  cạnh một `index.tsx` mà `index.tsx` không đọc thế giới là đủ dữ kiện để báo. Đây là mã duy nhất
  trong bốn mã còn thiếu mà bộ dò hiện có **đã đủ** để giữ.

## Khi nào cần kiểm lại

- Tệp nguồn thêm, bớt hoặc đổi tên một luật.
- Hằng số `REACHES_FOR_THE_WORLD` được nới hoặc thu.
- Một trong hai biểu thức chính quy phạm vi đổi, kể cả chỉ đổi một đoạn đường dẫn.
- Một luật bắt đầu đọc tệp thứ hai.
- Một cửa mở kê ở trên được đóng, hoặc một cửa mở mới bị phát hiện ngoài đời.
- Một kho mã xin ngoại lệ cho `bypass` trên thẻ thường.
- Một trong bốn mã chưa có luật được nhận một luật.
- Mức nghiêm trọng trong `recommended` không còn là `error`.
