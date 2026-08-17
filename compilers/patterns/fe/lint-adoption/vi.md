---
title: Lint-adoption · Vietnamese
---

# Lint adoption

Đầu vào là một shape đã được duyệt: repo đã được chốt là chạy dưới bộ rule canon của front end, và không ai mở lại chuyện có nên hay không. Đầu ra là kiến trúc source — file nào giữ khối gắn, tầng nào giữ bằng chứng, thứ gì rời canon như một khối có version, config đã resolve phải in ra cái gì, và pass nào mới được phép sửa source sản phẩm. Pattern này không biện hộ cho bộ rule; nó hạ bộ rule đó xuống thành file.

## Luật

Adoption là config ESLint thực sự áp lên một file production thật. Nó không phải một thư mục plugin, không phải một dòng import, không phải một tên package, và không phải một bộ rule tự nuôi mang cái tiền tố quen thuộc. Câu hỏi quyết định chỉ có một:

> `eslint --print-config` có cho thấy đủ mọi rule canon ở mức `error`, và có từ chối inline config không?

Mọi tín hiệu khác — plugin resolve được, thư mục có tồn tại, file config có nhắc đúng tên — đều chỉ mô tả repo **có gì**. Luật này nói về việc ESLint **làm gì**, và hai thứ đó đã lệch nhau đủ nhiều lần để chỉ thứ thứ hai được tính là bằng chứng.

**Đây là luật bắt buộc, không phải lời khuyên.** Một repo hoặc được cai trị bởi trọn bộ rule, hoặc không; không có trạng thái đã adopt một phần mà vẫn được tính là đã adopt. Một bộ rule về tới nơi mà thiếu bảy rule không phải là adoption có lỗ nhỏ, nó là một bộ rule khác đang mang tên cũ.

## Mã tình huống

Mọi tình huống module này cai quản đều mang một mã, `LINT-ADOPTION-<n>`. Mã gọi tên TÌNH HUỐNG; các cột nói tình huống đó đòi source phải trông thế nào và từ chối cái gì.

| Mã | Tình huống | Source phải trông thế nào |
|---|---|---|
| `LINT-ADOPTION-1` | Một repo tiêu thụ gắn bộ canon vào | Plugin, recommendation và linter options gắn vào như một khối có version; config chỉ spread khối đã nhận chứ không tự liệt kê tên rule. Cấm: một subset viết tay tại chỗ của bất kỳ cái nào trong ba thứ đó |
| `LINT-ADOPTION-2` | Adoption phải được chứng minh, không phải được khẳng định | Audit effective-config canon chạy lên ít nhất một file source production thật, gọi kèm `--probe` trỏ vào file đang ship. Cấm: đọc adoption ra từ một dòng import, một tên thư mục, hay sự hiện diện của plugin |
| `LINT-ADOPTION-3` | Rule đã tới nơi — nhưng ở mức nào | Mọi rule trong recommendation canon resolve ra `error`; `missing: []` và `nonError: []`. Cấm: một plugin viết tay chạy song song, hoặc một đợt rollout ở mức warning |
| `LINT-ADOPTION-4` | Một file có thể tự tắt luật từ bên trong chính nó | Config đã resolve đặt `linterOptions.noInlineConfig` là `true`; `refusesInlineConfig: true`. Cấm: một file tự quyết, từ bên trong nó, rằng luật của repo có áp lên nó hay không |
| `LINT-ADOPTION-5` | Một pass muốn sửa source sản phẩm trong lúc audit đang đỏ | Việc Apply và fidelity dừng lại trước khi sửa production khi audit này còn hỏng; `ok: true` trước commit đầu tiên của pass. Cấm: viết source sản phẩm mà một hàng rào chưa đủ sẽ gọi là hợp lệ |

Cách đánh số là cố định và được trích dẫn từ ngoài module này. Một mã không bao giờ bị đánh số lại để lấp một chỗ trống trong dãy; bất đồng với một mã được ghi lại như một rủi ro còn mở, chứ không sửa mã.

## Đọc một shape đã duyệt

1. **Đọc xem shape nói gì.** Nó nói repo này được cai trị bởi bộ canon, và nói các glob mà repo sở hữu — luật áp lên những cây source nào. Đó là dữ kiện của riêng repo.
2. **Đọc xem nó không nói gì, và vì thế không giải quyết gì.** Nó không nói config đã resolve in ra cái gì. Nó không nói rule kết thúc ở mức nào, không nói một block config đứng sau có ghi đè `linterOptions` hay không, không nói file probe có nằm trong glob được cai trị hay không. Không thứ nào trong đó do shape quyết; chúng do phép đo quyết.
3. **Giải quyết từ ngoài vào trong.** Khối gắn đứng trước bằng chứng, bằng chứng đứng trước mức của rule, mức của rule đứng trước việc từ chối inline, và cả bốn đứng trước mọi câu hỏi về source sản phẩm. Một subset chưa bao giờ tới nơi thì không thể đo là `error`, và một audit đỏ quyết định câu hỏi cuối cùng bất kể mấy câu kia.
4. **Hỏi câu hỏi của từng mã, theo thứ tự.** `LINT-ADOPTION-1`: plugin, recommendation và linter options có rời canon như một khối có version không, hay có ai đó đã chép tay một phần? `LINT-ADOPTION-2`: config đã resolve có được in ra bằng chính ESLint của repo đích, cho một file đang ship không? `LINT-ADOPTION-3`: `missing` có rỗng và `nonError` có rỗng không? `LINT-ADOPTION-4`: `linterOptions.noInlineConfig` in ra có đọc là `true` không? `LINT-ADOPTION-5`: pass này có sắp đụng vào source sản phẩm trong lúc `ok` đang là false không?
5. **Khi hai mã cùng khớp, gọi tên cả hai và xử theo mã ngoài hơn.** Một subset chép tay mà lại toàn `error` là `LINT-ADOPTION-1`, không phải một `LINT-ADOPTION-3` sạch — `missing` thường là triệu chứng của mã 1, còn `nonError` gần như luôn là mã 3. Gắn đúng mà không bao giờ đo là `LINT-ADOPTION-2`, chưa phải adoption. Đo rồi làm ngơ kết quả đỏ là `LINT-ADOPTION-5`, không phải `LINT-ADOPTION-2`.

## `LINT-ADOPTION-1` — gắn nguyên khối, không tự cắt subset

**Tình huống.** Một repo tiêu thụ canon phải nhận ba thứ cùng lúc: plugin, recommendation (tên rule kèm mức), và linter options. Ba thứ đó rời canon như một khối có version. Repo viết tay lại một phần bất kỳ trong ba thứ đó là đã tạo ra canon thứ hai — không phải vào ngày viết, mà vào ngày một trong hai danh sách thay đổi.

**Nó sinh ra gì trong source.** Config của repo tiêu thụ spread khối gắn đã nhận. Attachment factory trong [`@starci/eslint-canon-fe`](../../../../@starci/eslint-canon-fe) cho glob, linter options, plugin và rule rời đi trong MỘT khối, và ném lỗi khi recommendation rỗng thay vì trả về một khối không có rule nào. Không giữ thư mục plugin tự nuôi bên cạnh bản mirror, và không có bản sao thứ hai của cùng bộ rule ở bất kỳ đâu trong repo.

**Dấu hiệu nhận biết.** `eslint.config.mjs` tự liệt kê tên rule trong `rules: {}` thay vì spread cái đã nhận. Có một thư mục plugin do repo tự nuôi nằm cạnh bản mirror. Có nơi trong repo giữ thêm một bản sao thứ hai của cùng bộ rule. Ai đó nói "đã import plugin rồi" khi được hỏi repo đang bị cai trị bởi bao nhiêu rule. Phép thử: ngày mai canon thêm một rule, repo này có nhận được nó mà không ai phải sửa tay không? Nếu phải sửa tay, đây là một bản sao chứ không phải một khối.

**Ranh giới.** Đây không phải `LINT-ADOPTION-3`: mã 1 hỏi rule có tới nơi không, mã 3 hỏi tới rồi thì ở mức nào. Một subset viết tay có thể toàn `error` mà vẫn hỏng ở mã 1, vì thứ nó thiếu là những rule không được chép vào. Nó cũng không phải `LINT-ADOPTION-2`: mã 1 nói về cách gắn, mã 2 nói về cách chứng minh đã gắn. Gắn đúng mà không đo vẫn chưa phải bằng chứng.

**Tình huống nghiệp vụ hay gặp.** Repo mới clone lần đầu · monorepo và single-app dùng chung luật nhưng khác glob · một repo giữ lại plugin cũ để chuyển dần · CI job chỉ fetch một repo · Docker build chỉ copy một thư mục · ai đó sửa trực tiếp vào thư mục mirror cho nhanh.

## `LINT-ADOPTION-2` — đo trên file production thật

**Tình huống.** Load được plugin chỉ chứng minh rule tồn tại. Nó không chứng minh ESLint bật rule đó cho file nào. Bằng chứng duy nhất có giá trị là config đã resolve cho một file thật đang ship, in ra bằng chính ESLint của repo đích chứ không phải đọc bằng mắt từ file config.

**Nó sinh ra gì trong source.** Một lần chạy [`scripts/audit-fe-lint-adoption.mjs`](../../../../scripts/audit-fe-lint-adoption.mjs), trong đó `--probe` là bắt buộc và config bị đem ra xét được spawn ra từ chính ESLint của repo đích chứ không đọc từ file config của nó. Đường dẫn probe trỏ vào một file source production nằm trong glob được cai trị — không phải file test, không phải file config, không phải file script. Source candidate của một pass Preview nằm trong các glob đó một cách có chủ đích.

**Dấu hiệu nhận biết.** Kết luận adoption được rút ra từ việc mở `eslint.config.mjs` ra đọc. Không ai chạy được lệnh audit, hoặc chạy nhưng `--probe` trỏ vào file test, file config, file script. Repo xanh nhưng không ai nói được nó xanh dưới bao nhiêu rule. Glob không phủ tới file được chọn làm probe, và không ai nhận ra vì kết quả vẫn in ra bình thường. Phép thử: file vừa dùng làm probe có thật sự nằm trong tập file sẽ được ship không? Nếu nó là file test hay file cấu hình thì vừa đo một thứ không ai deploy.

**Ranh giới.** Đây không phải `LINT-ADOPTION-1`: xem trên. Nó cũng không phải `LINT-ADOPTION-5`: mã 2 là hành động đo, mã 5 là hệ quả khi kết quả đỏ. Đo xong rồi làm ngơ là hỏng ở mã 5, không phải mã 2.

**Tình huống nghiệp vụ hay gặp.** Nhận bàn giao một repo lạ · trước khi mở một pass Apply · sau khi sửa xong wiring · sau khi canon thêm rule mới · khi số lỗi lint tự nhiên giảm mà không ai sửa gì · khi một file candidate của pass Preview sắp được port vào production.

## `LINT-ADOPTION-3` — mọi rule resolve ra `error`

**Tình huống.** Rule đã tới nơi rồi thì phải ở mức `error`, tất cả, không trừ cái nào. Một bộ warning-level, hoặc một plugin viết tay chạy song song, tạo ra kiến trúc thứ hai yếu hơn — và kiến trúc yếu hơn là cái thắng, vì nó là cái không chặn merge.

**Nó sinh ra gì trong source.** Config in ra resolve mọi rule canon thành `error`. `severityOf` trong [`@starci/eslint-canon-fe`](../../../../@starci/eslint-canon-fe) thu mọi cách viết của một mức severity về một con số, và danh sách `nonError` gom mọi thứ khác `2`; cả `missing` lẫn `nonError` trả về rỗng. `recommended` trong [`@starci/eslint-canon-fe`](../../../../@starci/eslint-canon-fe) được gom từ mọi module, mọi mức đều `error` và không module nào có quyền tự quyết. Không có block config đứng sau ghi đè mức của rule cho một glob tạm thời.

**Dấu hiệu nhận biết.** Trong output audit, `nonError` không rỗng: rule có mặt nhưng ở `warn` hoặc `off`. Trong output audit, `missing` không rỗng: rule không tồn tại trong config đã resolve. Có block config đứng sau ghi đè mức của một vài rule cho một glob tạm thời. Có người mô tả `warn` là giai đoạn rollout. Phép thử: nếu một violation mới của rule này được viết hôm nay, nó có chặn được không? Nếu chỉ in ra một dòng vàng rồi merge thì rule đó chưa được adopt, chỉ được nhắc tới.

**Ranh giới.** Đây không phải `LINT-ADOPTION-1`: `missing` thường là triệu chứng của mã 1, `nonError` gần như luôn là mã 3. Nó cũng không phải `LINT-ADOPTION-4`: mã 3 nói về mức của rule, mã 4 nói về việc rule đó có bị một comment trong chính file vi phạm tắt đi được không. Đủ `error` mà vẫn cho inline disable thì mức kia chỉ là mức mặc định.

**Tình huống nghiệp vụ hay gặp.** Repo có nợ cũ, muốn hạ xuống `warn` cho qua · canon thêm rule mới mà repo chưa mirror lại · một glob legacy được miễn · một rule bị `off` trong lúc debug rồi ở lại vĩnh viễn · hai repo cùng canon nhưng đếm ra hai số lỗi khác nhau.

## `LINT-ADOPTION-4` — config đã resolve từ chối inline config

**Tình huống.** `noInlineConfig` không phải là một tuỳ chọn khắt khe thêm. Nó là thứ khiến một directive trong file không có tác dụng, thay vì chỉ bị coi là sai. Thiếu nó, tác giả của vi phạm đồng thời là người quyết định đó có phải vi phạm hay không.

**Nó sinh ra gì trong source.** `refusesInlineConfig`, đọc từ `linterOptions.noInlineConfig` ĐÃ IN RA, trong [`@starci/eslint-canon-fe`](../../../../@starci/eslint-canon-fe), và được `ok` đòi hỏi song song với phép so danh sách rule, trả về `true`. Config của repo tiêu thụ áp bộ linter options đã đóng băng do [`@starci/eslint-canon-fe`](../../../../@starci/eslint-canon-fe) công bố bên cạnh rule báo cáo directive. Source sản phẩm không mang `eslint-disable`, `eslint-disable-next-line` hay `eslint-enable`.

**Dấu hiệu nhận biết.** `refusesInlineConfig: false` trong output audit, dù danh sách rule đã đủ. Config gắn rule nhưng quên spread linter options. Một block config đứng sau ghi đè `linterOptions` và không ai để ý, vì flat config lấy block sau. Source sản phẩm có `eslint-disable`, `eslint-disable-next-line`, hoặc `eslint-enable`. Phép thử: một dòng comment đặt đúng chỗ có tắt được rule đang báo lỗi chính dòng đó không? Nếu có thì cái đang đứng đó không phải hàng rào.

**Ranh giới.** Đây không phải `LINT-ADOPTION-3`: xem trên. Nó cũng không phải luật `lint-escape-hatch`: rule báo cáo directive thuộc luật kia, còn linter option làm directive vô hiệu là điều kiện adoption ở đây. Cần cả hai: một cái giải thích vì sao hỏng, một cái bảo đảm directive không tự bịt miệng được người canh nó.

**Tình huống nghiệp vụ hay gặp.** Một file vendor cần cú pháp lạ · một migration tạm · một file generated · một component vội cần merge trước demo · một PR thêm `eslint-disable` kèm lý do rất hợp lý viết ngay bên cạnh.

## `LINT-ADOPTION-5` — audit đỏ thì dừng trước khi sửa source

**Tình huống.** Code viết dưới một hàng rào chưa đủ có thể hợp lệ tại chỗ mà vẫn vi phạm canon. Nó không đỏ, nên không ai biết. Nó sẽ đỏ vào đúng ngày wiring được sửa xong — và lúc đó khoản nợ đã mang tên người khác.

**Nó sinh ra gì trong source.** Không có thay đổi nào trong source sản phẩm khi `ok` còn là false. [`scripts/audit-fe-lint-adoption.mjs`](../../../../scripts/audit-fe-lint-adoption.mjs) thoát với mã khác không khi `ok` là false, và cái exit khác không đó là tín hiệu mà một pass buộc phải dừng lại, chứ không phải ghi chú thêm vào. Diff wiring và diff sản phẩm nằm ở hai commit riêng, để còn đọc được cái nào gây ra cái nào.

**Dấu hiệu nhận biết.** Một pass Apply hoặc fidelity bắt đầu sửa `.tsx` trong khi audit chưa từng chạy, hoặc chạy ra `ok: false`. Có người nói sửa lint sau, giờ làm tính năng trước. Diff sản phẩm và diff wiring nằm chung một commit, nên không ai đọc được cái nào gây ra cái nào. Một pass đo lường — khảo sát trùng lặp, đối chiếu parity — chạy trên repo đang hỏng adoption và báo kết quả như thật. Phép thử: nếu wiring được sửa xong ngay sau commit này, diff vừa viết có còn xanh không? Nếu không chắc, nghĩa là nó đang được chấm bởi một tập luật khác với tập sẽ chấm nó ngày mai.

**Ranh giới.** Đây không phải `LINT-ADOPTION-2`: mã 2 là phép đo, mã 5 là thứ mà kết quả đỏ bắt buộc phải làm. Nó cũng không phải ngoại lệ của chính nó: sửa wiring không phải sửa source sản phẩm. Mã 5 chặn source sản phẩm; nó không chặn việc chữa đúng cái config vừa đỏ, trong một boundary đã được duyệt trước khi bắt đầu.

**Tình huống nghiệp vụ hay gặp.** Nhận task mới trên repo lâu không đụng tới · vừa pull về một loạt rule mới · sắp port candidate của pass Preview · deadline demo · một sửa lỗi chỉ một dòng · khảo sát consolidation trên một repo chưa adopt.

## Tầng giữ

Tầng nào thật sự giữ từng mã — `unrepresentable` (một union đóng hoặc branded type khiến giá trị sai không viết ra được), `enforced` (một lint rule từ [`@starci/eslint-canon-fe`](../../../../@starci/eslint-canon-fe) bắt được, nêu tên ở đây), hay `documented` (không có gì cơ học giữ nó; chỉ có người đọc).

| Mã | Tầng | Cái gì thật sự giữ nó |
|---|---|---|
| `LINT-ADOPTION-1` | `documented` | [`scripts/sync-fe-lint.mjs`](../../../../scripts/sync-fe-lint.mjs) báo cáo một thư mục plugin tự nuôi và một bản mirror đã lệch — nhưng đó là một script ai đó chọn chạy, không phải một rule mà build sẽ đỏ vì nó |
| `LINT-ADOPTION-2` | `documented` | [`scripts/audit-fe-lint-adoption.mjs`](../../../../scripts/audit-fe-lint-adoption.mjs) thực hiện audit; không có gì bắt buộc được rằng audit đã được thực hiện |
| `LINT-ADOPTION-3` | `documented` | `audits["effective-config"]` trả về `nonError`, và chỉ trả về khi được gọi |
| `LINT-ADOPTION-4` | `documented` | cũng chính audit đó trả về `refusesInlineConfig`; giá trị nó tìm do [`@starci/eslint-canon-fe`](../../../../@starci/eslint-canon-fe) công bố, và đó là rule của một module khác |
| `LINT-ADOPTION-5` | `documented` | một người đọc, hoặc một skill biết dừng |

Cả năm đều là `documented`, và artifact giữ luật này công bố `rules = {}` một cách có chủ đích chứ không phải do bỏ bê. Một ESLint rule nhìn thấy cây cú pháp bên trong một file, dưới một configuration đã được resolve xong. Toàn bộ đề tài của luật này chính là cái resolve đó: rule có mặt hay không, nó kết thúc ở mức severity nào, directive có được tôn trọng hay không. Một rule bị bắt phán xử những dữ kiện ấy sẽ đang phán xử chính cái config đã quyết định rule đó có chạy hay không — và kiểu hỏng ở đây là im lặng, vì một rule bị tắt thì không báo gì và một repo không bị cai trị bởi gì cả thì lint sạch trơn. Vì thế thứ giữ luật này là một audit ở tầm repo trên `eslint --print-config` chứ không phải một rule, và vì thế bảng này hiện năm dòng `documented` thay vì giả vờ khác đi. Tầng sở hữu mối quan tâm này là config đã resolve của repo cùng audit chạy trên nó; mọi tầng sản phẩm — component, block, page — phải ngu ngơ về nó và không bao giờ được mang một ý kiến cục bộ về việc rule nào cai trị mình.

## Điểm neo

Một luật không chỉ tay được vào code thật chỉ là một đề xuất. Mỗi mã một dòng, kèm đường dẫn và thứ phải tìm ở đó.

| Mã | Đường dẫn | Tìm gì ở đó |
|---|---|---|
| `LINT-ADOPTION-1` | [`@starci/eslint-canon-fe`](../../../../@starci/eslint-canon-fe) | Attachment factory được export: glob, linter options, plugin và rule rời đi trong MỘT khối, và một recommendation rỗng thì ném lỗi thay vì trả về một khối không có rule nào |
| `LINT-ADOPTION-2` | [`scripts/audit-fe-lint-adoption.mjs`](../../../../scripts/audit-fe-lint-adoption.mjs) | `--probe` là bắt buộc, và config bị đem ra xét được spawn ra từ chính ESLint của repo đích chứ không đọc từ file config của nó |
| `LINT-ADOPTION-3` | [`@starci/eslint-canon-fe`](../../../../@starci/eslint-canon-fe) | `severityOf`, thứ thu mọi cách viết của một mức severity về một con số, và danh sách `nonError` gom mọi thứ khác `2` |
| `LINT-ADOPTION-4` | [`@starci/eslint-canon-fe`](../../../../@starci/eslint-canon-fe) | `refusesInlineConfig`, đọc từ `linterOptions.noInlineConfig` ĐÃ IN RA, và được `ok` đòi hỏi song song với phép so danh sách rule |
| `LINT-ADOPTION-5` | [`scripts/audit-fe-lint-adoption.mjs`](../../../../scripts/audit-fe-lint-adoption.mjs) | Cái exit khác không khi `ok` là false — tín hiệu mà một pass buộc phải dừng lại, chứ không phải ghi chú thêm vào. **Neo một phần** — xem bên dưới |

Bằng chứng thứ cấp, hữu ích khi chính điểm neo chính đang bị thay đổi:

- `LINT-ADOPTION-1` — [`scripts/sync-fe-lint.mjs`](../../../../scripts/sync-fe-lint.mjs): digest nội dung của bản mirror, và phát hiện được nêu khi một thư mục plugin tự nuôi vẫn còn tồn tại bên cạnh nó.
- `LINT-ADOPTION-3` — [`@starci/eslint-canon-fe`](../../../../@starci/eslint-canon-fe): `recommended`, gom từ mọi module, mọi mức đều `error` và không module nào có quyền tự quyết.
- `LINT-ADOPTION-4` — [`@starci/eslint-canon-fe`](../../../../@starci/eslint-canon-fe): bộ linter options đã đóng băng mà một config tiêu thụ sẽ áp, công bố ngay bên cạnh rule báo cáo directive.
- `LINT-ADOPTION-5` — skill Apply của lint-sync nêu điều kiện đóng mà chỉ `ok: true` mới thoả, còn skill Plan của consolidation thì rẽ đi chỗ khác thay vì đo một repo đang hỏng adoption.

`LINT-ADOPTION-5` có neo cho việc lint-sync và **chưa neo được** cho Apply của design và fidelity: không file nào trong các skill đó đọc audit này, nên cái điểm dừng mà chúng nợ chỉ tồn tại trong lời văn và không ở đâu khác. Nó được ghi lại như một rủi ro còn mở.

## Đầu vào

| Đầu vào | Bằng chứng phải có |
|---|---|
| probe | Đường dẫn của một file source production thật nằm trong glob được cai trị |
| printed config | Output của chính `eslint --print-config` của repo đích cho file probe đó |
| recommendation | Bản đồ rule-sang-mức của canon, gom từ mọi module, không phải một subset |
| linter options | `linterOptions` đã resolve, đọc từ config in ra chứ không phải từ file config nguồn |
| phase | Việc nào đang hỏi: wiring, Apply, fidelity, hay một pass đo lường |

## Quy tắc

1. Adoption là thuộc tính của config đã resolve, không bao giờ là của một file, thư mục hay tên package.
2. Plugin, recommendation và linter options đi cùng nhau và lên version cùng nhau.
3. Repo sở hữu việc luật áp lên glob nào; repo không sở hữu ý kiến nào về nội dung luật.
4. Thiếu và bị hạ mức là hai phát hiện khác nhau, và không cái nào là warning.
5. Một rule có thể bị tắt bởi chính comment mà nó đang báo lỗi thì không phải hàng rào.
6. Audit chạy trên source sẽ ship, kể cả source mà một pass sau sẽ port vào production.
7. Audit đỏ là một điểm dừng, không phải một ghi chú đính kèm diff.
8. Thiếu lint rule cho một mã là một khoảng trống được ghi ra, không bao giờ là lý do hạ mã đó xuống.

## Ngoại lệ

Ngoại lệ là một phần của luật, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ mã nó áp dụng vào.

- **Config thuộc về repo.** `LINT-ADOPTION-1` ràng buộc rule, mức của rule và việc từ chối inline. Luật áp lên glob nào là việc của repo: monorepo lint package dùng chung và từng app, single-app lint một cây source. Rule là luật; glob là nơi luật có hiệu lực.
- **Plugin khác của repo.** `LINT-ADOPTION-1`: một config tiêu thụ bảo toàn plugin không liên quan của riêng nó, `ignores` của riêng nó và `languageOptions` của riêng nó. Thứ nó không được giữ là một ý kiến thứ hai về bộ rule canon.
- **Source candidate không được miễn.** `LINT-ADOPTION-2`: một candidate của pass Preview chính là source mà một pass sau sẽ port vào production. Nó nằm trong glob được cai trị một cách có chủ đích, để đúng cái file sẽ thành production không phải là file được chấm bởi không gì cả.
- **Sửa wiring không phải sửa sản phẩm.** `LINT-ADOPTION-5` chặn source sản phẩm, không chặn việc chữa đúng cái config đã hỏng, theo một boundary đã được duyệt trước khi bắt đầu.
- **Nợ được ghi, không được hạ.** `LINT-ADOPTION-3`: rule chưa mang sang được thì ghi vào sổ nợ kèm giá của nó, và ở mọi nơi nó đã tồn tại thì vẫn giữ nguyên mức cao nhất. Ghi lại một khoảng thiếu giữ cho con số trung thực; hạ mức làm ranh giới thành tuỳ chọn cho mọi người tới sau.

## Đầu ra

```text
probe: <production file the effective config was printed for>
unit: <one versioned unit | local subset>
missing: <canonical rules absent from the effective config>
nonError: <canonical rules resolved below error>
refusesInlineConfig: <true | false>
situation: <LINT-ADOPTION-1 | LINT-ADOPTION-2 | LINT-ADOPTION-3 | LINT-ADOPTION-4 | LINT-ADOPTION-5>
verdict: <ok | stop>
reason: <the measured fact that decided it>
```

Mỗi probe mà shape sinh ra là một khối: một monorepo lint package dùng chung và từng app sẽ sinh một khối cho mỗi cây source được cai trị, vì mỗi cây tự resolve ra config hiệu lực của riêng nó.

## Ví dụ đã giải

Shape đã duyệt: *front end single-app này adopt bộ rule canon trên cây source của chính nó, và có một pass Apply đang xếp hàng chờ sửa component sản phẩm trong cây đó.*

Shape nói ra bộ rule và cái cây mà luật áp lên. Nó không nói config hiệu lực in ra cái gì — không nói mức của rule, không nói có block nào đứng sau ghi đè `linterOptions` hay không, không nói config spread khối đã nhận hay tự liệt kê tên rule bằng tay — và vì thế nó không giải quyết cái nào trong số đó. Chúng chỉ được chốt bằng cách in config ra, không phải bằng cách đọc shape.

Đo trên cây source của app:

```text
probe: src/app/dashboard/page.tsx
unit: local subset
missing: [seven canonical rules absent from the effective config]
nonError: []
refusesInlineConfig: true
situation: LINT-ADOPTION-1
verdict: stop
reason: the config lists rule names in rules: {} instead of spreading the attachment block, so rules added to canon never arrive
```

Dòng `reason` gọi tên đúng dữ kiện loại trừ `LINT-ADOPTION-3`: mọi rule đã tới nơi đều resolve ra `error`, nên `nonError` rỗng — chỗ hỏng là những rule chưa bao giờ được chép vào, tức mã 1, chứ không phải một mức bị hạ, vốn sẽ là mã 3.

Sau khi sửa xong wiring, đo lại trên cùng cây source đó:

```text
probe: src/app/dashboard/page.tsx
unit: one versioned unit
missing: []
nonError: []
refusesInlineConfig: false
situation: LINT-ADOPTION-4
verdict: stop
reason: a later config block overrides linterOptions, so the printed noInlineConfig is false and a comment can switch off the rule reporting its own line
```

Dòng `reason` gọi tên đúng dữ kiện loại trừ `LINT-ADOPTION-3`: danh sách rule đã đủ và mọi mức đều là `error`, nên không có gì thuộc về severity quyết định chuyện này — thứ quyết định là `linterOptions.noInlineConfig` in ra bằng `false`, tức mã 4.

Chỉ khi một khối trả về `missing: []`, `nonError: []`, `refusesInlineConfig: true` và `verdict: ok` thì pass Apply đang xếp hàng mới được đụng vào source sản phẩm; chừng nào một trong hai khối trên còn đứng đó, `LINT-ADOPTION-5` giữ nó lại. Và phải nói rõ cái gì đang giữ điểm dừng ấy: không có gì cơ học cả. Cả năm mã đều là `documented`, và với Apply của design và fidelity thì điểm dừng đó không được neo trong bất kỳ file nào.

## Phạm vi

Module này nêu một quy tắc đúng với mọi front end có lint. Nó không gọi tên sản phẩm nào, thư viện component nào hay repo nào. Mọi ví dụ đều là một flat config bình thường và TSX bình thường; namespace plugin trong ví dụ chỉ là chỗ điền tạm, và luật không đổi khi nó được viết khác đi.
