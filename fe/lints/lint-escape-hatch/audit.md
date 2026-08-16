---
id: fe-lints-lint-escape-hatch-audit
title: audit.md
slug: /fe/lints/lint-escape-hatch/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phủ của một rule so với ba mã luật, và giá phải trả để khép từng cửa còn hở.
---

# audit.md

> Version: `2.00` · Module: `lint-escape-hatch`

Phản biện này kiểm đúng một câu hỏi: **cái máy có giữ được luật không, và ở đâu thì không.**

## Verdict

Chấp nhận, kèm điều kiện. Rule duy nhất của mô-đun bắt đúng thứ nó nhận là bắt, phần bắt hụt ở
directive-trong-lời-văn là **có chủ ý và đúng**, và không có chỗ nào truyền được ngoại lệ vào rule.

Điều kiện: mô-đun này **không** được đọc như "đã có máy gác nên yên tâm". Rule phủ trọn
`LINT-ESCAPE-1` cho họ directive `disable`/`enable` **trong** đoạn `/src/`, phủ một nửa
`LINT-ESCAPE-2`, và **không phủ** `LINT-ESCAPE-3`. Ba khoảng trống đáng kể đã ghi ở mục rủi ro.

**Số rule đếm được: 1.** Tệp nguồn công bố đúng một rule qua `rules` — `no-inline-lint-config` — khớp
với con số dự kiến. Ba export còn lại không phải rule và không được đếm: `noInlineLintConfig` là chính
đối tượng ấy dưới tên khác, `recommended` là bảng mức độ, `linterOptions` là cấu hình phẳng.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `eslint-disable` mở đầu chú thích | Nổ. `^\s*` cho phép không hoặc nhiều khoảng trắng |
| Cùng directive nhưng có lý do phía sau | Nổ. `\b` đóng phép khớp trước phần lý do |
| Directive ở dòng thứ hai của chú thích khối | Nổ. `\s` bao cả ký tự xuống dòng |
| `eslint-enable` đứng một mình | Nổ. Là nhánh riêng trong mẫu |
| Từ `eslint-disabled` trong lời văn | Không nổ. `\b` không khớp giữa `e` và `d` — đúng ý |
| Câu văn nhắc tới `eslint-disable` giữa chú thích | Không nổ. Bắt hụt có chủ ý, khớp với chỗ bộ lint cũng không nghe |
| Đường dẫn Windows dùng `\` | Nổ. `normalizePath` chuẩn hoá trước khi so |
| Chú thích trong biểu thức đánh dấu | Nổ. Vẫn là node chú thích bình thường |
| Chú thích cấu hình trần `/* eslint rule: "off" */` | **Không nổ**. Mẫu không biết dạng này |
| Tệp không có đoạn `/src/` | **Không chạy**. `create` trả `{}` |
| Miễn trừ viết trong cấu hình phẳng | **Không nhìn thấy**. Rule không đọc cấu hình |

## Findings

1. **Tên rule rộng hơn phần rule bắt.** `no-inline-lint-config` gợi ý mọi dạng cấu hình lint tại chỗ;
   mẫu chỉ phủ họ `eslint-disable`/`eslint-enable`. Dạng trần `/* eslint rule: "off" */`,
   `/* eslint-env … */` và `/* globals … */` đều là cấu hình tại chỗ, đều được bộ lint nghe theo, và
   đều lọt. Đây là chênh lệch tên–hành vi lớn nhất của mô-đun.
2. **`LINT-ESCAPE-3` không có rule nào.** Không có gì quét danh sách miễn trừ. Thứ thật sự đứng thay
   là `schema: []`: rule không nhận tuỳ chọn, nên không truyền ngoại lệ vào rule được. Điều đó khép
   cửa "miễn trừ tại chỗ gọi" và để nguyên cửa "miễn trừ trong cấu hình".
3. **`LINT-ESCAPE-2` được giữ bởi hai thứ khác loại.** Rule *báo*, `linterOptions.noInlineConfig`
   *vô hiệu hoá*. Chỉ một trong hai là rule, và cái còn lại phụ thuộc việc kho tiêu thụ có áp hay
   không. Mô-đun này không thể tự chứng minh nửa sau đã được áp.
4. **Cổng `/src/` là cổng theo chuỗi, không phải theo đoạn đường dẫn.** Nó đòi có dấu phân cách đứng
   trước, nên cùng một tệp gọi bằng đường dẫn tương đối `src/thing.tsx` thì không được canh. Tên thư
   mục cũng là thứ rẻ nhất trong một kho để đổi.
5. **Phép quét chỉ nhìn chú thích.** Chuỗi ký tự chứa directive, hoặc bề mặt mà bộ phân tích không gắn
   chú thích vào cây, đều nằm ngoài tầm nhìn.
6. **Không có gì canh việc rule được đăng ký.** `recommended` đặt mức `error`, nhưng một cấu hình
   trải rồi ghi đè vẫn hạ được mức, và mô-đun không tự phát hiện.

## Decisions

- **Giữ đúng một rule trong tài liệu này.** Rule "đáng lẽ nên có" — chẳng hạn một rule bắt dạng chú
  thích cấu hình trần, hay một rule soi cấu hình phẳng — **không** được viết vào `INDEX.md`. Luật cao
  nhất của canon: thứ không chỉ tay vào được là một đề xuất, không phải một rule. Chúng nằm ở mục
  rủi ro bên dưới.
- **Giữ tên rule làm danh tính duy nhất.** Không gán mã số riêng cho rule. Tên đã là chuỗi hiện trong
  bản dựng, trong dòng tắt lint và trong mọi cuộc trao đổi; một danh tính thứ hai chỉ tạo ra tình
  cảnh một rule hai tên và không cách nào biết thông báo đến từ tên nào.
- **Giữ nguyên phần bắt hụt ở lời văn.** Đây là lựa chọn đã trả giá một lần: mẫu không neo từng khiến
  câu giải thích bị báo là vi phạm. Bắt hụt ở đây không phải lỗ hổng mà là đúng đường biên của thứ
  đang được thi hành.
- **Ghi mọi cửa hở bằng lời thật thà, kể cả cửa làm mô-đun trông yếu.** Không viết "không có" cho gọn
  bảng.
- **Không đổi cổng `/src/` trong bản này.** Xem lý do ở rủi ro tương ứng.

## Rủi ro còn mở

Mỗi mục nêu **rule sẽ phải soi cái gì** mới khép được cửa, hoặc vì sao khép đắt hơn để hở.

1. **Chú thích cấu hình trần và họ hàng (`eslint rule: "off"`, `eslint-env`, `globals`).**
   *Khép bằng cách nào:* mở rộng mẫu thành thứ nhận diện toàn bộ họ directive mà bộ lint công nhận —
   `eslint`, `eslint-env`, `eslint-enable`, `eslint-disable*`, `globals`, `exported` — vẫn neo ở đầu
   thân chú thích. Đây là thay đổi rẻ và đáng làm; rủi ro duy nhất là bắt trúng chú thích mở đầu bằng
   đúng chữ `eslint` trong lời văn, xử lý được bằng cách đòi có dấu phân cách hoặc dấu hai chấm ngay
   sau tên directive. **Nên khép ở bản sau.**
2. **`LINT-ESCAPE-3` không có rule.**
   *Khép bằng cách nào:* cần một rule soi **tệp cấu hình**, không soi mã nguồn sản phẩm — đọc các khối
   cấu hình phẳng và báo bất kỳ khối nào vừa khoanh `files` vừa hạ mức một rule của bộ luật này. Việc
   này khả thi nhưng khác loại hẳn: nó lint chính cấu hình, cần biết hình dạng cấu hình phẳng, và dễ
   vỡ khi cấu hình được ghép từ nhiều tệp hoặc dựng động. **Là hạng mục riêng, không phải một dòng
   thêm vào rule hiện có.**
3. **Cổng `/src/` bỏ sót cây thư mục không có `src`, và bỏ sót đường dẫn tương đối.**
   *Khép bằng cách nào:* đảo cổng lại — mặc định **mọi** tệp đều là mã nguồn sản phẩm, rồi loại trừ
   theo một danh sách hẹp các thư mục kiểm thử/khuôn mẫu. Cách này khép được cả hai lỗ. Giá phải trả:
   danh sách loại trừ chính là hình dạng mà `LINT-ESCAPE-3` cấm, chỉ khác là nó nằm trong rule chứ
   không nằm ở chỗ gọi. **Để hở trong bản này**, vì đổi cổng mà không đồng thời thống nhất được bố cục
   thư mục sẽ biến một cổng đơn giản thành một danh sách miễn trừ trá hình.
4. **Directive laundered qua chuỗi ký tự và mã sinh tự động.**
   *Khép bằng cách nào:* rule sẽ phải soi cả `Literal` và `TemplateLiteral`, tức là báo mọi chuỗi có
   chứa chữ directive. Chi phí báo nhầm ở đây rất cao — tài liệu, kiểm thử, chính bộ sinh mã đều nhắc
   tới chuỗi ấy một cách hợp pháp. **Rẻ hơn nhiều nếu chặn ở chỗ khác:** lint luôn đầu ra của bộ sinh
   mã, thay vì lint ý định của bộ sinh mã.
5. **Bề mặt không phải JavaScript và bộ phân tích không gắn chú thích.**
   *Khép bằng cách nào:* đăng ký bộ xử lý cho từng loại tệp muốn canh. Đây là việc của cấu hình, không
   phải của rule; rule không thể tự với tới thứ chưa ai giao cho nó.
6. **Cấu hình tiêu thụ quên áp `linterOptions.noInlineConfig`.**
   *Khép bằng cách nào:* không khép được từ trong rule — một rule không quan sát được `linterOptions`
   đang có hiệu lực hay không. Chỉ khép được bằng một phép kiểm cấu hình hiệu dụng chạy ngoài bộ rule,
   in ra cấu hình thật rồi khẳng định hàng rào có mặt. **Rủi ro này là thật và không tự tan.**
7. **Rule bị gỡ khỏi plugin hoặc bị hạ mức.**
   *Khép bằng cách nào:* cũng bằng phép kiểm cấu hình hiệu dụng ở trên, cộng một kiểm thử sinh đôi
   khẳng định rule có nổ trên một mẫu vi phạm. Không rule nào tự canh được việc mình có được nối dây.

## Re-audit Triggers

- Tệp nguồn công bố thêm hoặc bớt một rule, hoặc đổi tên một rule đang có.
- Mẫu `INLINE_DIRECTIVE` được sửa, kể cả chỉ thêm một nhánh.
- Cổng `isProductSource` đổi khỏi phép thử chuỗi `/src/`.
- Xuất hiện một dòng tắt lint trong mã nguồn sản phẩm mà bản dựng vẫn xanh — dấu hiệu một cửa đã ghi
  ở trên đang được dùng thật.
- Kho tiêu thụ báo có nhiều báo nhầm, tức mẫu đang bắt trúng lời văn.
- Bộ lint đổi cách nhận diện directive, khiến ranh giới "bắt hụt đúng chỗ" dịch đi.
- Có đề xuất thêm bất kỳ danh sách theo đường dẫn nào, ở bất kỳ đâu.
