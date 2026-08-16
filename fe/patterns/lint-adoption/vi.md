---
id: fe-patterns-lint-adoption-vi
title: vi.md
slug: /fe/patterns/lint-adoption/vi
sidebar_label: vi.md
sidebar_position: 1
description: Các tình huống LINT-ADOPTION-N, nhận diện bằng config ESLint đã resolve chứ không bằng tên file.
---

# vi.md

> Version: `2.00` · Module: `lint-adoption`

# Lint adoption

Adoption là **config ESLint thực sự áp lên một file production thật**, không phải một thư mục
plugin, một dòng import, hay một bộ rule tự nuôi mang cái tên quen thuộc.

Câu hỏi quyết định chỉ có một:

> `eslint --print-config` cho một file production thật có cho thấy **đủ** rule canon ở mức `error`,
> và có từ chối inline config không?

Mọi tín hiệu khác đều nói về việc repo **có gì**. Luật này nói về việc ESLint **làm gì**. Hai thứ đó
đã lệch nhau đủ nhiều lần để chỉ thứ thứ hai được tính là bằng chứng.

**Đây là luật bắt buộc.** Một repo hoặc được cai trị bởi trọn bộ rule, hoặc không. Không có trạng
thái "đã adopt một phần". Một bộ rule về tới nơi mà thiếu bảy rule không phải là adoption có lỗ nhỏ
— nó là **một bộ rule khác** đang mang tên cũ.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | Bằng chứng phải có |
|---|---|---|
| `LINT-ADOPTION-1` | Gắn plugin, recommendation và linter options như **một khối có version** | Config chỉ spread khối gắn kèm, không tự liệt kê rule |
| `LINT-ADOPTION-2` | Chạy audit effective-config lên **file production thật** | Lệnh audit có `--probe` trỏ vào file đang ship |
| `LINT-ADOPTION-3` | Mọi rule trong recommendation resolve ra `error` | `missing: []` và `nonError: []` |
| `LINT-ADOPTION-4` | Config đã resolve đặt `linterOptions.noInlineConfig` là `true` | `refusesInlineConfig: true` |
| `LINT-ADOPTION-5` | Audit đỏ thì **dừng trước** khi sửa source sản phẩm | `ok: true` trước commit đầu tiên của pass |

---

## `LINT-ADOPTION-1` — gắn nguyên khối, không tự cắt subset

**Tình huống.** Một repo tiêu thụ canon phải nhận **ba thứ cùng lúc**: plugin, recommendation (tên
rule kèm mức), và linter options. Ba thứ đó rời khỏi canon như một khối có version. Repo viết tay
lại một phần bất kỳ trong ba thứ đó là đã tạo ra **canon thứ hai** — không phải vào ngày viết, mà
vào ngày một trong hai danh sách thay đổi.

**Dấu hiệu nhận biết**

- `eslint.config.mjs` tự liệt kê tên rule trong `rules: {}` thay vì spread cái đã nhận.
- Có một thư mục plugin do repo tự nuôi, nằm cạnh bản mirror.
- Có nơi trong repo giữ thêm một bản sao thứ hai của cùng bộ rule.
- Ai đó nói "đã import plugin rồi" khi được hỏi repo đang bị cai trị bởi bao nhiêu rule.

**Tự hỏi.** Ngày mai canon thêm một rule, repo này có nhận được nó mà **không ai phải sửa tay** gì
không? Nếu phải sửa tay — đây không phải một khối, đây là một bản sao.

**Ranh giới**

- ↔ `LINT-ADOPTION-3`: mã 1 hỏi **rule có tới nơi không**; mã 3 hỏi **tới rồi thì ở mức nào**. Một
  subset viết tay có thể toàn `error` mà vẫn hỏng ở mã 1, vì thứ nó thiếu là những rule không được
  chép vào.
- ↔ `LINT-ADOPTION-2`: mã 1 nói về cách gắn; mã 2 nói về cách **chứng minh** đã gắn. Gắn đúng mà
  không đo vẫn chưa phải bằng chứng.

**Tình huống nghiệp vụ hay gặp.** Repo mới clone lần đầu · monorepo và single-app dùng chung luật
nhưng khác glob · một repo giữ lại plugin cũ "để chuyển dần" · CI job chỉ fetch một repo · Docker
build chỉ copy một thư mục · ai đó sửa trực tiếp vào thư mục mirror cho nhanh.

**Cái repo vẫn được sở hữu.** Glob — luật áp **ở đâu**. Cùng với plugin không liên quan của riêng
nó, `ignores` của riêng nó và `languageOptions` của riêng nó. Thứ nó không được giữ là **một ý kiến
thứ hai về luật**.

---

## `LINT-ADOPTION-2` — đo trên file production thật

**Tình huống.** Load được plugin chỉ chứng minh rule **tồn tại**. Nó không chứng minh ESLint **bật**
rule đó cho file nào. Bằng chứng duy nhất có giá trị là config đã resolve cho một file thật đang
ship — in ra bằng chính ESLint của repo đích, không phải đọc bằng mắt từ file config.

**Dấu hiệu nhận biết**

- Kết luận adoption được rút ra từ việc mở `eslint.config.mjs` ra đọc.
- Không ai chạy được lệnh audit, hoặc chạy nhưng `--probe` trỏ vào file test, file config, file
  script.
- Repo "xanh" nhưng không ai nói được nó xanh dưới bao nhiêu rule.
- Glob không phủ tới file được chọn làm probe, và không ai nhận ra vì kết quả vẫn in ra bình thường.

**Tự hỏi.** File tôi vừa dùng làm probe có thật sự nằm trong tập file sẽ được ship không? Nếu nó là
file test hay file cấu hình, tôi vừa đo một thứ không ai deploy.

**Ranh giới**

- ↔ `LINT-ADOPTION-1`: xem trên.
- ↔ `LINT-ADOPTION-5`: mã 2 là **hành động đo**; mã 5 là **hệ quả khi kết quả đỏ**. Đo xong rồi làm
  ngơ là hỏng ở mã 5, không phải mã 2.

**Tình huống nghiệp vụ hay gặp.** Nhận bàn giao một repo lạ · trước khi mở một pass Apply · sau khi
sửa xong wiring · sau khi canon thêm rule mới · khi số lỗi lint tự nhiên giảm mà không ai sửa gì ·
khi một file candidate của pass Preview sắp được port vào production.

**Source candidate cũng phải nằm trong tập được đo.** File candidate chính là source mà một pass sau
sẽ port vào production. Bỏ nó ra ngoài glob nghĩa là đúng cái file sẽ thành production là file duy
nhất không bị luật nào soi.

---

## `LINT-ADOPTION-3` — mọi rule resolve ra `error`

**Tình huống.** Rule đã tới nơi rồi thì phải ở mức `error`, tất cả, không trừ cái nào. Một bộ
warning-level, hoặc một plugin viết tay chạy song song, tạo ra **kiến trúc thứ hai yếu hơn** — và
kiến trúc yếu hơn là cái thắng, vì nó là cái không chặn merge.

**Dấu hiệu nhận biết**

- Trong output audit, `nonError` không rỗng: rule có mặt nhưng ở `warn` hoặc `off`.
- Trong output audit, `missing` không rỗng: rule không tồn tại trong config đã resolve.
- Có block config đứng sau ghi đè mức của một vài rule cho một glob "tạm thời".
- Có người mô tả `warn` là "giai đoạn rollout".

**Tự hỏi.** Nếu một violation mới của rule này được viết hôm nay, nó có **chặn** được không? Nếu chỉ
in ra một dòng vàng rồi merge — rule đó chưa được adopt, chỉ được nhắc tới.

**Ranh giới**

- ↔ `LINT-ADOPTION-1`: xem trên. `missing` thường là triệu chứng của mã 1; `nonError` gần như luôn
  là mã 3.
- ↔ `LINT-ADOPTION-4`: mã 3 nói về **mức** của rule; mã 4 nói về việc rule đó có bị một comment trong
  chính file vi phạm tắt đi được không. Đủ `error` mà vẫn cho inline disable thì mức kia chỉ là mức
  mặc định.

**Tình huống nghiệp vụ hay gặp.** Repo có nợ cũ, muốn hạ xuống `warn` cho qua · canon thêm rule mới
mà repo chưa mirror lại · một glob "legacy" được miễn · một rule bị `off` trong lúc debug rồi ở lại
vĩnh viễn · hai repo cùng canon nhưng đếm ra hai số lỗi khác nhau.

**Nợ được ghi, không được hạ.** Rule chưa mang sang được thì viết vào sổ nợ kèm giá của nó, và ở
những nơi nó đã có thì vẫn `error`. Ghi lại một khoảng thiếu giữ cho con số trung thực; hạ mức làm
ranh giới thành tuỳ chọn cho mọi người tới sau.

---

## `LINT-ADOPTION-4` — config đã resolve từ chối inline config

**Tình huống.** `noInlineConfig` không phải là một tuỳ chọn khắt khe thêm. Nó là thứ khiến một
directive trong file **không có tác dụng**, thay vì chỉ bị coi là sai. Thiếu nó, tác giả của vi phạm
đồng thời là người quyết định đó có phải vi phạm hay không.

**Dấu hiệu nhận biết**

- `refusesInlineConfig: false` trong output audit, dù danh sách rule đã đủ.
- Config gắn rule nhưng quên spread linter options.
- Một block config đứng sau ghi đè `linterOptions` và không ai để ý, vì flat config lấy block sau.
- Source sản phẩm có `eslint-disable`, `eslint-disable-next-line`, hoặc `eslint-enable`.

**Tự hỏi.** Một dòng comment đặt đúng chỗ có tắt được rule đang báo lỗi chính dòng đó không? Nếu có
— cái đang đứng đó không phải hàng rào.

**Ranh giới**

- ↔ `LINT-ADOPTION-3`: xem trên.
- ↔ luật `lint-escape-hatch`: **rule báo cáo** directive thuộc luật kia; **linter option làm directive
  vô hiệu** là điều kiện adoption ở đây. Cần cả hai: một cái giải thích vì sao hỏng, một cái bảo đảm
  directive không tự bịt miệng được người canh nó.

**Tình huống nghiệp vụ hay gặp.** Một file vendor cần cú pháp lạ · một migration "tạm" · một file
generated · một component vội cần merge trước demo · một PR thêm `eslint-disable` kèm lý do rất hợp
lý viết ngay bên cạnh.

---

## `LINT-ADOPTION-5` — audit đỏ thì dừng trước khi sửa source

**Tình huống.** Code viết dưới một hàng rào chưa đủ có thể **hợp lệ tại chỗ** mà vẫn vi phạm canon.
Nó không đỏ, nên không ai biết. Nó sẽ đỏ vào đúng ngày wiring được sửa xong — và lúc đó khoản nợ đã
mang tên người khác.

**Dấu hiệu nhận biết**

- Một pass Apply hoặc fidelity bắt đầu sửa `.tsx` trong khi audit chưa từng chạy, hoặc chạy ra
  `ok: false`.
- Có người nói "sửa lint sau, giờ làm tính năng trước".
- Diff sản phẩm và diff wiring nằm chung một commit, nên không ai đọc được cái nào gây ra cái nào.
- Một pass đo lường (khảo sát trùng lặp, đối chiếu parity) chạy trên repo đang hỏng adoption và báo
  kết quả như thật.

**Tự hỏi.** Nếu wiring được sửa xong ngay sau khi tôi commit, diff tôi vừa viết có còn xanh không?
Nếu không chắc — nghĩa là tôi đang được chấm bởi một tập luật khác với tập sẽ chấm nó ngày mai.

**Ranh giới**

- ↔ `LINT-ADOPTION-2`: xem trên.
- ↔ ngoại lệ của chính mã này: **sửa wiring không phải sửa source sản phẩm**. Mã 5 chặn source sản
  phẩm; nó không chặn việc chữa đúng cái config vừa đỏ, trong một boundary đã được duyệt trước.

**Tình huống nghiệp vụ hay gặp.** Nhận task mới trên repo lâu không đụng tới · vừa pull về một loạt
rule mới · sắp port candidate của pass Preview · deadline demo · một sửa lỗi "chỉ một dòng" · khảo
sát consolidation trên một repo chưa adopt.

---

## Luật

1. Adoption là thuộc tính của **config đã resolve**, không phải của file, thư mục hay tên package.
2. Plugin, recommendation và linter options đi cùng nhau và lên version cùng nhau.
3. Repo sở hữu **glob**; repo không sở hữu ý kiến nào về nội dung luật.
4. `missing` và `nonError` là hai phát hiện khác nhau, và không cái nào được hạ thành warning.
5. Một rule có thể bị tắt bởi chính comment mà nó đang báo lỗi thì không phải hàng rào.
6. Audit chạy trên source sẽ ship, kể cả source mà một pass sau sẽ port vào production.
7. Audit đỏ là một **điểm dừng**, không phải một ghi chú đính kèm diff.
8. Thiếu lint rule cho một mã là một khoảng trống **được ghi ra**, không bao giờ là lý do hạ mã đó
   xuống.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ
mã nó áp dụng vào.

- **Config thuộc về repo.** `LINT-ADOPTION-1` ràng buộc rule, mức của rule và việc từ chối inline.
  Luật áp lên **glob nào** là việc của repo: monorepo lint package dùng chung và từng app, single-app
  lint một cây source. Rule là luật; glob là nơi luật có hiệu lực.
- **Plugin khác của repo.** Repo bảo toàn plugin không liên quan, `ignores` và `languageOptions`
  của nó. Thứ nó không được giữ là một ý kiến thứ hai về bộ rule canon.
- **Source candidate không được miễn.** Candidate chính là source sẽ được port vào production, nên
  nó nằm trong glob **có chủ đích**.
- **Sửa wiring không phải sửa sản phẩm.** `LINT-ADOPTION-5` chặn source sản phẩm, không chặn việc
  chữa đúng cái config đã đỏ, trong boundary đã duyệt trước.
- **Nợ được ghi, không được hạ.** Rule chưa mang sang được thì ghi vào sổ nợ kèm giá; ở mọi nơi nó
  đã tồn tại thì vẫn `error`.
