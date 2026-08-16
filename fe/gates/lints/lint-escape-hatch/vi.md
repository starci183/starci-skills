---
id: fe-lints-lint-escape-hatch-vi
title: vi.md
slug: /gates/lints/lint-escape-hatch/vi
sidebar_label: vi.md
sidebar_position: 1
description: Một luật cấm tự tắt lint, một rule giữ nó — bắt được gì, và còn cửa nào chưa khép.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `lint-escape-hatch`

# Cấm tự tắt lint

Luật đứng sau tài liệu này chỉ nói một câu: **tệp vi phạm không được là tệp quyết định có vi phạm hay
không**. Khi một dòng chú thích tắt được rule ngay tại chỗ, người viết ra lỗi cũng đồng thời là người
phán rằng đó không phải lỗi.

Nhưng tài liệu này không nói về luật. Nó nói về **cái máy giữ luật**: một rule duy nhất, nó nhìn thấy
gì, và — phần gần như không ai chịu viết ra — nó **không** nhìn thấy gì.

Một luật không có rule thì ai cũng biết là luật suông. Một rule **tưởng là kín** mà thật ra hở thì
nguy hơn nhiều, vì chính niềm tin "đã có máy gác" là thứ khiến không ai đi kiểm lại.

## Bảng tra nhanh

| Rule | Mã luật | Bắt gì |
|---|---|---|
| `no-inline-lint-config` | `LINT-ESCAPE-1` | Chú thích trong mã nguồn sản phẩm mà **mở đầu** bằng directive `eslint-disable`, `eslint-disable-line`, `eslint-disable-next-line` hoặc `eslint-enable` |

Hai chỗ cần nói thẳng ngay ở đây:

- `LINT-ESCAPE-2` chỉ được giữ **một nửa** bằng rule. Rule báo cáo hành vi né luật; phần làm cho hành
  vi đó **vô hiệu** là `linterOptions.noInlineConfig` — một mẩu cấu hình phẳng mà kho tiêu thụ phải tự
  áp vào, không phải một rule có thể tự làm đỏ bản dựng.
- `LINT-ESCAPE-3` **không có rule nào cả**. Không có gì đi quét danh sách miễn trừ. Thứ thay thế nó là
  `schema: []`: rule không nhận tuỳ chọn nào, nên không ai truyền được một ngoại lệ theo đường dẫn vào
  cho nó. Cửa đó khép; cửa cấu hình thì vẫn mở toang.

---

## `no-inline-lint-config`

**Bắt gì?** Mọi chú thích nằm trong mã nguồn sản phẩm mà **thân chú thích bắt đầu** bằng một directive
đổi tập rule đang chạy: `eslint-disable`, `eslint-disable-line`, `eslint-disable-next-line`,
`eslint-enable`. Kèm lý do phía sau cũng không thay đổi gì — lý do chỉ ghi lại việc né luật, nó không
ngăn việc né luật.

**Giữ mã nào?** `LINT-ESCAPE-1`, trọn vẹn. Một nửa của `LINT-ESCAPE-2` — nửa *báo cáo*. `LINT-ESCAPE-3`
thì không, và đó là một phát hiện chứ không phải một ánh xạ để bịa cho đủ bảng.

**Phát hiện thế nào?**

1. **Cổng đường dẫn.** Lấy `context.filename`, thiếu thì lấy `context.getFilename()`, đổi mọi dấu `\`
   thành `/`, rồi đòi chuỗi kết quả **chứa** `/src/`. Không chứa thì `create` trả về `{}` — rule không
   tồn tại với tệp đó.
2. **Điểm móc.** Đúng một handler `Program`, chạy một lần khi vào chương trình.
3. **Nguồn dữ liệu.** `context.sourceCode.getAllComments()` — tất cả node chú thích `Line` và `Block`
   mà bộ phân tích cú pháp đã gắn vào cây.
4. **Phép so.** `comment.value` khớp với `/^\s*eslint-(?:disable(?:-next-line|-line)?|enable)\b/`.
5. **Báo cáo.** Ngay trên node chú thích, `messageId: "directive"`.

Ba chi tiết trong mẫu đó quyết định gần hết hành vi thật:

- **`^` neo ở đầu thân chú thích**, vì đó là chỗ duy nhất một directive được công nhận. Mẫu không neo
  thì bắt trúng **chữ** thay vì bắt trúng **directive** — một câu giải thích rằng tệp này không hề tắt
  lint lại bị báo là đang tắt lint, và cách duy nhất cho im là thôi viết lời giải thích. Đó là ngược
  hẳn ý luật. Bắt hụt ở đây không phải là đánh đổi: directive mà bộ lint chịu nghe thì luôn nằm ở đầu.
- **`\s` bao cả ký tự xuống dòng**, nên chú thích khối để directive ở dòng thứ hai vẫn bị bắt.
- **`\b` đóng phép khớp ngay sau tên directive**, nên phần lý do phía sau không được đọc tới, và một từ
  dài hơn như `eslint-disabled` thì không khớp.

**Vì sao nên để máy giữ luật này?** Ba lý do, không lý do nào thuộc về thẩm mỹ:

- Một ngoại lệ cục bộ **không bao giờ tự chết**. Nó sống bằng tuổi của tệp, và ai đọc chỗ gọi cũng
  không thấy nó.
- Ngoại lệ cục bộ **giết luôn phản hồi** đáng lẽ dùng để sửa luật. Nếu một rule bắt nhầm mười chỗ, mười
  dòng tắt lint sẽ khiến không ai biết rule đó sai; một bản dựng đỏ thì biết ngay.
- Người ta chỉ tắt lint ở đúng chỗ luật đang phát huy tác dụng nhất — ranh giới kiến trúc, kiểu dữ
  liệu, phụ thuộc của hook. Cái bị tắt không phải là mấy rule vặt, mà là mấy rule đắt nhất.

**Những chỗ còn lọt.** Từng cửa dưới đây đều là **thiếu sót đã ghi nhận**, không phải giấy phép. Viết theo
một trong các dạng đó để khỏi bị báo lỗi vẫn là đúng cái hành vi luật cấm, dù bản dựng có xanh:

1. **Chú thích cấu hình trần: `/* eslint some-rule: "off" */`.** Đây mới là dạng đổi cấu hình lint tại
   chỗ ở nghĩa đen nhất, bộ lint nghe theo nó, và mẫu **không** khớp — mẫu chỉ biết họ `disable`/
   `enable`. Tên rule hứa "no inline lint config", phần bắt thì hẹp hơn tên.
2. **`/* eslint-env node */` và `/* globals FLAG */`.** Cùng một lỗ hổng họ hàng: đổi cách tệp được
   lint, không mở đầu bằng `eslint-disable` hay `eslint-enable`.
3. **Tệp không có đoạn `/src/` trong đường dẫn.** Thư mục route, view hay tiện ích đặt thẳng ở gốc kho
   nằm ngoài cổng. Ở đó rule không yếu đi — nó **không có mặt**.
4. **Đường dẫn không có dấu phân cách đứng trước.** Cùng một tệp, gọi là `/kho/src/thing.tsx` thì bị
   canh, đưa vào bộ lint dưới tên tương đối `src/thing.tsx` thì không, vì cổng đòi đúng `/src/`.
5. **Miễn trừ viết trong cấu hình phẳng thay vì viết trong tệp.** Một khối cấu hình khoanh theo đường
   dẫn rồi hạ rule xuống `off` hoặc `warn` đạt đúng thứ `LINT-ESCAPE-3` cấm. Rule đọc chú thích trong
   mã nguồn; nó không bao giờ đọc cấu hình.
6. **Directive cất trong chuỗi rồi mới ghi ra sau:** `const BANNER = "// eslint-disable-next-line"`.
   Chuỗi ký tự không phải chú thích. Bất cứ thứ gì đem chuỗi đó ghi vào một tệp đều đã đưa directive
   lọt qua một phép quét chỉ nhìn chú thích.
7. **Chú thích ở bề mặt mà bộ phân tích không giao lại:** chú thích trong đánh dấu, trong một phương
   ngữ khuôn mẫu, hoặc trong loại tệp chưa đăng ký bộ phân tích. `getAllComments()` chỉ trả về thứ đã
   được gắn vào cây.
8. **Cấu hình tiêu thụ quên áp `linterOptions.noInlineConfig`.** Khi đó một dòng
   `/* eslint-disable <id của chính rule này> */` đặt ở đầu tệp sẽ bịt miệng người gác **trước khi**
   người gác kịp báo. Báo cáo và hàng rào là hai export khác nhau, và chỉ một trong hai là rule.
9. **Gỡ rule khỏi plugin, hoặc không trải `recommended` vào cấu hình.** Không rule nào tự canh việc
   mình có được đăng ký hay không. Một hàng rào chưa nối dây thì không khác gì một luật chưa ai viết.

## Luật

1. Danh tính của rule là **tên đã công bố** của nó. Không đặt thêm mã số riêng cho rule; tên đó đã là
   thứ hiện trong bản dựng, trong dòng tắt lint và trong mọi cuộc trao đổi về lần đỏ ấy.
2. Rule **báo cáo**; cấu hình **vô hiệu hoá**. Không cái nào thay được cái kia, và tài liệu này phải
   nói rõ cái nào đang giữ phần nào.
3. Rule không nhận tuỳ chọn, nên không có chỗ để viết một danh sách miễn trừ vào chỗ gọi.
4. Chỉ ghi vào tài liệu này những rule **thật sự tồn tại** trong tệp nguồn. Rule "đáng lẽ nên có" đi
   xuống mục rủi ro của `audit.md`.
5. Mỗi rule phải có **ít nhất một** cửa còn mở được viết ra một cách thật thà, hoặc một lập luận rõ
   ràng rằng nó kín. Viết "không có" cho gọn bảng là điều cấm.

## Ngoại lệ

Không có. `LINT-ESCAPE-3` nói không có danh sách miễn trừ, và `schema: []` khiến không có chỗ nào để
viết danh sách ấy.

Có đúng một ranh giới hay bị đọc nhầm thành ngoại lệ: các tệp kiểm thử cố tình dựng ra directive bị
cấm đều nằm **ngoài** mọi đoạn `/src/`. Đó là cái cổng làm đúng việc của nó trên một tệp không phải mã
nguồn sản phẩm, chứ không phải một suất miễn trừ cấp cho mã nguồn sản phẩm.
